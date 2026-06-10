import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'
import { SsmlData } from './ssmlGenerator'
import { TestMode } from './storage'

export interface TestResult {
  ssmlIndex: number
  iteration: number
  provenanceEnabled: boolean
  firstByteLatencyMs?: number
  lastByteLatencyMs?: number
  totalBytes?: number
  chunkCount?: number
  maxRtf?: number  // Max Real-Time Factor: elapsed_time / audio_duration. If > 1.0, slower than playback
  audioData?: ArrayBuffer  // Store audio data for playback and detect
  success: boolean
  error?: string
  timestamp: string
  requestId?: string  // X-RequestId for log correlation (from SDK resultId or HTTP response header)
}

interface RunTestOptions {
  ssmls: SsmlData[]
  iterations: number
  subscriptionKey: string
  endpoint: string | null
  region: string | null
  outputFormat: string
  testMode?: TestMode
  useHttpApi?: boolean  // Use HTTP REST API instead of WebSocket SDK
  onProgress: (current: number, total: number, label: string) => void
  onResult: (result: TestResult) => void
  signal: AbortSignal
}

const OUTPUT_FORMAT_MAP: Record<string, SpeechSDK.SpeechSynthesisOutputFormat> = {
  'raw-24khz-16bit-mono-pcm': SpeechSDK.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm,
  'riff-24khz-16bit-mono-pcm': SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm,
  'audio-24khz-96kbitrate-mono-mp3': SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3,
  'audio-24khz-160kbitrate-mono-mp3': SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3,
  'riff-16khz-16bit-mono-pcm': SpeechSDK.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm,
  'riff-48khz-16bit-mono-pcm': SpeechSDK.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm,
  'audio-48khz-96kbitrate-mono-mp3': SpeechSDK.SpeechSynthesisOutputFormat.Audio48Khz96KBitRateMonoMp3,
  'audio-48khz-192kbitrate-mono-mp3': SpeechSDK.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3,
}

// Provenance mode: undefined = don't set header (server default), false = set to false, true = set to true
type ProvenanceMode = boolean | undefined

// Request parameter/header names (matching Frontend's RequestVariants and RequestHeaders)
const PROVENANCE_QUERY_PARAM = 'provenance'  // URL query parameter for WebSocket SDK
const PROVENANCE_HEADER = 'X-Microsoft-Provenance-Enabled'  // HTTP header for REST API

/**
 * Extract sample rate from output format string.
 * Examples: 'raw-24khz-16bit-mono-pcm' -> 24000, 'audio-48khz-96kbitrate-mono-mp3' -> 48000
 */
function getSampleRateFromFormat(format: string): number {
  const match = format.match(/(\d+)khz/i)
  if (match) {
    return parseInt(match[1]) * 1000
  }
  return 24000  // default fallback
}

/**
 * Calculate RTF (Real-Time Factor) for audio streaming.
 * RTF = elapsed_time_ms / audio_duration_ms
 * If RTF > 1.0, audio generation is slower than playback speed.
 */
function calcRtf(sampleRate: number, cumulativeBytes: number, elapsedMs: number): number {
  if (sampleRate <= 0 || cumulativeBytes <= 0) return 0
  // audio_duration_ms = bytes / (2 * sampleRate) * 1000  (16-bit = 2 bytes per sample)
  const audioMs = cumulativeBytes / (2 * sampleRate) * 1000
  return audioMs > 0 ? elapsedMs / audioMs : 0
}

/**
 * Convert WebSocket endpoint to HTTP endpoint
 * ws://localhost:12345/cognitiveservices/websocket/v1 -> http://localhost:12345/cognitiveservices/v1
 */
function wsToHttpEndpoint(wsEndpoint: string): string {
  return wsEndpoint
    .replace(/^wss?:\/\//, 'http://')
    .replace('/websocket/v1', '/v1')
}

/**
 * Get HTTP endpoint for Azure region
 */
function getRegionHttpEndpoint(region: string): string {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`
}

/**
 * Synthesize using HTTP REST API.
 * Uses X-Microsoft-Provenance-Enabled HTTP header for provenance control.
 */
async function synthesizeWithHttpApi(
  httpEndpoint: string,
  subscriptionKey: string,
  ssml: string,
  outputFormat: string,
  provenanceMode: ProvenanceMode,
  signal?: AbortSignal
): Promise<Omit<TestResult, 'ssmlIndex' | 'iteration' | 'timestamp'>> {
  const startTime = performance.now()
  
  const headers: Record<string, string> = {
    'Ocp-Apim-Subscription-Key': subscriptionKey,
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': outputFormat,
  }
  
  // Set provenance header if specified
  if (provenanceMode !== undefined) {
    headers[PROVENANCE_HEADER] = provenanceMode ? 'true' : 'false'
  }
  
  console.log(`HTTP API: ${httpEndpoint}, Provenance=${provenanceMode}`)
  
  const response = await fetch(httpEndpoint, {
    method: 'POST',
    headers,
    body: ssml,
    signal,
  })
  
  const firstByteTime = performance.now() - startTime
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }
  
  // Extract X-RequestId from response headers for log correlation
  const requestId = response.headers.get('X-RequestId') || undefined
  
  const audioData = await response.arrayBuffer()
  const lastByteTime = performance.now() - startTime
  // Calculate RTF for the full response (HTTP only has one "chunk")
  const sampleRate = getSampleRateFromFormat(outputFormat)
  const maxRtf = calcRtf(sampleRate, audioData.byteLength, lastByteTime)
  
  return {
    success: true,
    firstByteLatencyMs: firstByteTime,
    lastByteLatencyMs: lastByteTime,
    totalBytes: audioData.byteLength,
    chunkCount: 1,  // HTTP returns full response
    maxRtf,
    provenanceEnabled: provenanceMode === true,
    audioData,
    requestId,
  }
}

async function synthesizeWithLatencyTracking(
  speechConfig: SpeechSDK.SpeechConfig,
  ssml: string,
  provenanceMode: ProvenanceMode,
  outputFormat: string
): Promise<Omit<TestResult, 'ssmlIndex' | 'iteration' | 'timestamp'>> {
  return new Promise((resolve, reject) => {
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, null as any)
    const sampleRate = getSampleRateFromFormat(outputFormat)

    const startTime = performance.now()
    let firstByteTime: number | null = null
    let totalBytes = 0
    let chunkCount = 0
    let maxRtf = 0

    synthesizer.synthesizing = (_s, e) => {
      const elapsedMs = performance.now() - startTime
      if (firstByteTime === null && e.result.audioData && e.result.audioData.byteLength > 0) {
        firstByteTime = elapsedMs
      }
      totalBytes += e.result.audioData.byteLength
      chunkCount++
      
      // Calculate RTF for this cumulative point (skip first chunk)
      if (chunkCount > 1) {
        const rtf = calcRtf(sampleRate, totalBytes, elapsedMs)
        if (rtf > maxRtf) {
          maxRtf = rtf
        }
      }
    }

    synthesizer.speakSsmlAsync(
      ssml,
      result => {
        const endTime = performance.now()
        const lastByteTime = endTime - startTime

        synthesizer.close()

        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          resolve({
            success: true,
            firstByteLatencyMs: firstByteTime || lastByteTime,
            lastByteLatencyMs: lastByteTime,
            totalBytes: result.audioData.byteLength,
            chunkCount,
            maxRtf: maxRtf > 0 ? maxRtf : calcRtf(sampleRate, result.audioData.byteLength, lastByteTime),
            provenanceEnabled: provenanceMode === true,  // true only if explicitly set to true
            audioData: result.audioData.slice(0),  // Copy audio data
            requestId: result.resultId,  // SDK's resultId is the X-RequestId used in WebSocket messages
          })
        } else {
          reject(new Error(`Synthesis failed: ${result.errorDetails || 'Unknown error'}`))
        }
      },
      error => {
        synthesizer.close()
        reject(error)
      }
    )
  })
}

export async function runPerformanceTest(options: RunTestOptions): Promise<TestResult[]> {
  const { ssmls, iterations, subscriptionKey, endpoint, region, outputFormat, testMode = 'both', useHttpApi = false, onProgress, onResult, signal } = options

  // Determine which provenance modes to test based on testMode
  // undefined = don't set header (server default), false = set to false, true = set to true
  const provenanceModes: ProvenanceMode[] = 
    testMode === 'default' ? [undefined] :
    testMode === 'provOff' ? [false] :
    testMode === 'provOn' ? [true] :
    [false, true]  // 'both' - compare explicit false vs explicit true

  const totalTests = ssmls.length * iterations * provenanceModes.length
  let completedTests = 0
  const results: TestResult[] = []

  // Helper to get label for provenance mode
  const getProvLabel = (mode: ProvenanceMode) => 
    mode === undefined ? 'DEFAULT' : mode ? 'ON' : 'OFF'

  // Get HTTP endpoint if using HTTP API
  const httpEndpoint = useHttpApi 
    ? (endpoint ? wsToHttpEndpoint(endpoint) : getRegionHttpEndpoint(region!))
    : null

  console.log(`Running tests: useHttpApi=${useHttpApi}, endpoint=${httpEndpoint || endpoint || region}`)

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < ssmls.length; i++) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const ssmlData = ssmls[i]

      for (const provenanceMode of provenanceModes) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }

        const testLabel = `SSML ${ssmlData.index}/${ssmls.length}, Iter ${iter + 1}/${iterations}, Prov=${getProvLabel(provenanceMode)}${useHttpApi ? ' (HTTP)' : ''}`
        onProgress(completedTests, totalTests, testLabel)

        try {
          let synthesisResult: Omit<TestResult, 'ssmlIndex' | 'iteration' | 'timestamp'>

          if (useHttpApi && httpEndpoint) {
            // Use HTTP REST API (X-Microsoft-Provenance-Enabled header)
            synthesisResult = await synthesizeWithHttpApi(
              httpEndpoint,
              subscriptionKey,
              ssmlData.ssml,
              outputFormat,
              provenanceMode,
              signal
            )
          } else {
            // Use WebSocket SDK (provenance via 'provenance' URL query parameter)
            let speechConfig: SpeechSDK.SpeechConfig
            
            // Build endpoint URL with provenance parameter directly in the URL
            // because JS SDK's setServiceProperty may not add params to WebSocket URL
            if (endpoint) {
              const endpointUrl = new URL(endpoint)
              if (provenanceMode !== undefined) {
                endpointUrl.searchParams.set(PROVENANCE_QUERY_PARAM, provenanceMode ? 'true' : 'false')
              }
              console.log(`WebSocket endpoint with provenance: ${endpointUrl.toString()}`)
              speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(endpointUrl, subscriptionKey)
            } else {
              // For region-based endpoint, we need to construct the WebSocket URL manually
              const wsEndpoint = `wss://${region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1`
              const endpointUrl = new URL(wsEndpoint)
              if (provenanceMode !== undefined) {
                endpointUrl.searchParams.set(PROVENANCE_QUERY_PARAM, provenanceMode ? 'true' : 'false')
              }
              console.log(`WebSocket endpoint with provenance: ${endpointUrl.toString()}`)
              speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(endpointUrl, subscriptionKey)
            }

            speechConfig.speechSynthesisOutputFormat = OUTPUT_FORMAT_MAP[outputFormat] || SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm

            synthesisResult = await synthesizeWithLatencyTracking(speechConfig, ssmlData.ssml, provenanceMode, outputFormat)
          }

          const result: TestResult = {
            ssmlIndex: ssmlData.index,
            iteration: iter + 1,
            ...synthesisResult,
            timestamp: new Date().toISOString(),
          }

          results.push(result)
          onResult(result)
        } catch (error: any) {
          const result: TestResult = {
            ssmlIndex: ssmlData.index,
            iteration: iter + 1,
            provenanceEnabled: provenanceMode === true,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          }

          results.push(result)
          onResult(result)
        }

        completedTests++

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  }

  return results
}

interface WarmupOptions {
  ssml: string
  warmupRuns: number
  subscriptionKey: string
  endpoint: string | null
  region: string | null
  outputFormat: string
  onLog: (message: string) => void
  signal: AbortSignal
}

export async function runWarmup(options: WarmupOptions): Promise<void> {
  const { ssml, warmupRuns, subscriptionKey, endpoint, region, outputFormat, onLog, signal } = options

  if (warmupRuns <= 0) {
    return
  }

  onLog(`🔥 Starting warmup (${warmupRuns} runs each for ON/OFF)...`)

  for (let i = 0; i < warmupRuns; i++) {
    for (const provenanceMode of [false, true] as ProvenanceMode[]) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      try {
        let speechConfig: SpeechSDK.SpeechConfig
        
        // Build endpoint URL with provenance parameter directly
        if (endpoint) {
          const endpointUrl = new URL(endpoint)
          if (provenanceMode !== undefined) {
            endpointUrl.searchParams.set(PROVENANCE_QUERY_PARAM, provenanceMode ? 'true' : 'false')
          }
          speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(endpointUrl, subscriptionKey)
        } else {
          const wsEndpoint = `wss://${region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1`
          const endpointUrl = new URL(wsEndpoint)
          if (provenanceMode !== undefined) {
            endpointUrl.searchParams.set(PROVENANCE_QUERY_PARAM, provenanceMode ? 'true' : 'false')
          }
          speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(endpointUrl, subscriptionKey)
        }

        speechConfig.speechSynthesisOutputFormat = OUTPUT_FORMAT_MAP[outputFormat] || SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm

        await synthesizeWithLatencyTracking(speechConfig, ssml, provenanceMode, outputFormat)
        onLog(`  ✓ Warmup ${i + 1}/${warmupRuns}, Prov=${provenanceMode ? 'ON' : 'OFF'}`)
      } catch (error: any) {
        onLog(`  ✗ Warmup ${i + 1}/${warmupRuns}, Prov=${provenanceMode ? 'ON' : 'OFF'}: ${error.message}`)
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  onLog(`🔥 Warmup completed`)
}
