import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'
import { SsmlData } from './ssmlGenerator'
import { TestMode, TestOrder, Protocol } from './storage'

export interface TestResult {
  ssmlIndex: number
  iteration: number
  provenanceEnabled: boolean  // Whether provenance was explicitly enabled (true) for this test
  provenanceMode?: boolean  // Requested provenance mode: true=ON, false=OFF, undefined=server default
  isTargetEndpoint: boolean  // true = target FE, false = base FE
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
  baseEndpoint?: string | null  // Base/Master FE endpoint (when useDualEndpoints is true)
  targetEndpoint?: string | null  // Target FE endpoint (when useDualEndpoints is true)
  targetProvenanceEnabled?: boolean | null  // Enable provenance on target FE: true=ON, false=OFF, null=server default
  targetFlightEnabled?: boolean  // Enable ttsfrontend-provenance flight via setfeature query param
  useDualEndpoints?: boolean  // Use different endpoints for Base vs Target comparison
  region: string | null
  outputFormat: string
  testMode?: TestMode
  testOrder?: TestOrder  // Execution order when testMode='compare'
  apiDelay?: number  // Delay in ms between API calls (default: 100)
  useHttpApi?: boolean  // Deprecated: use HTTP REST API instead of WebSocket SDK (superseded by `protocol`)
  protocol?: Protocol  // Synthesis protocol: 'websocket' | 'http' | 'bidirectional' (default 'websocket')
  voiceName?: string  // Voice name, required for bidirectional text streaming (v2)
  keepAudio?: boolean  // Keep audio data in results for later download (default false to save memory)
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

// Request parameter names (matching Frontend's RequestVariants)
const PROVENANCE_QUERY_PARAM = 'provenance'  // URL query parameter for provenance control
const SETFEATURE_QUERY_PARAM = 'setfeature'  // URL query parameter for enabling flights
const PROVENANCE_FLIGHT_NAME = 'ttsfrontend-provenance'  // Flight name for provenance feature

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
 * Uses the 'provenance' URL query parameter for provenance control (same as the
 * WebSocket/bidirectional protocols) — no HTTP header is used.
 */
async function synthesizeWithHttpApi(
  httpEndpoint: string,
  subscriptionKey: string,
  ssml: string,
  outputFormat: string,
  provenanceMode: ProvenanceMode,
  flightEnabled: boolean,
  signal?: AbortSignal
): Promise<Omit<TestResult, 'ssmlIndex' | 'iteration' | 'timestamp' | 'isTargetEndpoint'>> {
  const startTime = performance.now()
  
  const headers: Record<string, string> = {
    'Ocp-Apim-Subscription-Key': subscriptionKey,
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': outputFormat,
  }

  // Provenance (and flight) are passed via URL query parameters, consistent with
  // the WebSocket/bidirectional protocols.
  const requestUrl = new URL(httpEndpoint)
  if (flightEnabled) {
    requestUrl.searchParams.set(SETFEATURE_QUERY_PARAM, PROVENANCE_FLIGHT_NAME)
  }
  if (provenanceMode !== undefined) {
    requestUrl.searchParams.set(PROVENANCE_QUERY_PARAM, provenanceMode ? 'true' : 'false')
  }
  
  console.log(`HTTP API: ${requestUrl.toString()}, Provenance=${provenanceMode}`)
  
  const response = await fetch(requestUrl.toString(), {
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
): Promise<Omit<TestResult, 'ssmlIndex' | 'iteration' | 'timestamp' | 'isTargetEndpoint'>> {
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

/**
 * Synthesize using the bidirectional v2 text-streaming API.
 * Connects to the endpoint as-is (expected path: /tts/cognitiveservices/websocket/v2),
 * streams plain text via SpeechSynthesisRequest, and measures audio chunk latency.
 */
async function synthesizeWithBidirectional(
  speechConfig: SpeechSDK.SpeechConfig,
  text: string,
  provenanceMode: ProvenanceMode,
  outputFormat: string
): Promise<Omit<TestResult, 'ssmlIndex' | 'iteration' | 'timestamp' | 'isTargetEndpoint'>> {
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
      if (chunkCount > 1) {
        const rtf = calcRtf(sampleRate, totalBytes, elapsedMs)
        if (rtf > maxRtf) {
          maxRtf = rtf
        }
      }
    }

    const request = new SpeechSDK.SpeechSynthesisRequest(SpeechSDK.SpeechSynthesisRequestInputType.TextStream)

    synthesizer.speakAsync(
      request,
      result => {
        const lastByteTime = performance.now() - startTime
        synthesizer.close()

        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          resolve({
            success: true,
            firstByteLatencyMs: firstByteTime || lastByteTime,
            lastByteLatencyMs: lastByteTime,
            totalBytes: result.audioData.byteLength,
            chunkCount,
            maxRtf: maxRtf > 0 ? maxRtf : calcRtf(sampleRate, result.audioData.byteLength, lastByteTime),
            provenanceEnabled: provenanceMode === true,
            audioData: result.audioData.slice(0),
            requestId: result.resultId,
          })
        } else {
          reject(new Error(`Bidirectional synthesis failed: ${result.errorDetails || 'Unknown error'}`))
        }
      },
      error => {
        synthesizer.close()
        reject(error)
      }
    )

    // Stream the text then signal end-of-stream.
    request.inputStream.write(text)
    request.inputStream.close()
  })
}

export async function runPerformanceTest(options: RunTestOptions): Promise<TestResult[]> {
  const { ssmls, iterations, subscriptionKey, endpoint, baseEndpoint, targetEndpoint, targetProvenanceEnabled, targetFlightEnabled = false, useDualEndpoints = false, region, outputFormat, testMode = 'compare', testOrder = 'baseFirst', apiDelay = 100, useHttpApi = false, protocol = (useHttpApi ? 'http' : 'websocket'), voiceName, keepAudio = false, onProgress, onResult, signal } = options

  const isHttp = protocol === 'http'
  const isBidirectional = protocol === 'bidirectional'

  // Convert null to undefined for provenanceMode (null means use server default)
  const targetProvenanceMode: ProvenanceMode = targetProvenanceEnabled ?? undefined

  // Define endpoint configs based on test mode
  // Each config: { isTarget: boolean, endpoint: string | null | undefined, provenanceMode: ProvenanceMode, flightEnabled: boolean }
  type EndpointConfig = { isTarget: boolean; endpoint: string | null | undefined; provenanceMode: ProvenanceMode; flightEnabled: boolean }
  
  const endpointConfigs: EndpointConfig[] = []
  
  if (testMode === 'default') {
    // Default mode: single endpoint, no provenance header
    endpointConfigs.push({ isTarget: false, endpoint: endpoint, provenanceMode: undefined, flightEnabled: false })
  } else if (testMode === 'base') {
    // Base only: use base endpoint, no provenance header (server default)
    const baseEp = useDualEndpoints ? baseEndpoint : endpoint
    endpointConfigs.push({ isTarget: false, endpoint: baseEp, provenanceMode: undefined, flightEnabled: false })
  } else if (testMode === 'target') {
    // Target only: use target endpoint, provenance as configured
    const targetEp = useDualEndpoints ? targetEndpoint : endpoint
    endpointConfigs.push({ isTarget: true, endpoint: targetEp, provenanceMode: targetProvenanceMode, flightEnabled: targetFlightEnabled })
  } else {
    // Compare mode: both base and target
    const baseEp = useDualEndpoints ? baseEndpoint : endpoint
    const targetEp = useDualEndpoints ? targetEndpoint : endpoint
    const baseConfig: EndpointConfig = { isTarget: false, endpoint: baseEp, provenanceMode: undefined, flightEnabled: false }
    const targetConfig: EndpointConfig = { isTarget: true, endpoint: targetEp, provenanceMode: targetProvenanceMode, flightEnabled: targetFlightEnabled }
    
    if (testOrder === 'baseFirst') {
      endpointConfigs.push(baseConfig, targetConfig)
    } else {
      endpointConfigs.push(targetConfig, baseConfig)
    }
  }

  const totalTests = ssmls.length * iterations * endpointConfigs.length
  let completedTests = 0
  const results: TestResult[] = []

  // Helper to get label for endpoint config
  const getConfigLabel = (config: EndpointConfig) => {
    const epType = config.isTarget ? 'Target' : 'Base'
    const provLabel = config.provenanceMode === undefined ? 'default' : config.provenanceMode ? 'ON' : 'OFF'
    return `${epType}(prov=${provLabel})`
  }

  // Helper to get HTTP endpoint from config
  const getHttpEndpoint = (config: EndpointConfig): string | null => {
    if (!isHttp) return null
    if (config.endpoint) {
      // If the endpoint is already an HTTP(S) URL (e.g. .../synthesize), use it as-is.
      if (/^https?:\/\//i.test(config.endpoint)) {
        return config.endpoint
      }
      return wsToHttpEndpoint(config.endpoint)
    }
    return region ? getRegionHttpEndpoint(region) : null
  }

  console.log(`Running tests: protocol=${protocol}, useDualEndpoints=${useDualEndpoints}, testMode=${testMode}, endpoint=${endpoint || region}`)

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < ssmls.length; i++) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const ssmlData = ssmls[i]

      for (const config of endpointConfigs) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }

        const currentEndpoint = config.endpoint
        const protocolTag = isHttp ? ' (HTTP)' : isBidirectional ? ' (Bidi v2)' : ''
        const testLabel = `SSML ${ssmlData.index}/${ssmls.length}, Iter ${iter + 1}/${iterations}, ${getConfigLabel(config)}${protocolTag}${useDualEndpoints ? ` [${currentEndpoint ? new URL(currentEndpoint).host : region}]` : ''}`
        onProgress(completedTests, totalTests, testLabel)

        try {
          let synthesisResult: Omit<TestResult, 'ssmlIndex' | 'iteration' | 'timestamp' | 'isTargetEndpoint'>

          const httpEndpoint = getHttpEndpoint(config)
          if (isHttp && httpEndpoint) {
            // Use HTTP REST API (provenance via 'provenance' URL query parameter)
            synthesisResult = await synthesizeWithHttpApi(
              httpEndpoint,
              subscriptionKey,
              ssmlData.ssml,
              outputFormat,
              config.provenanceMode,
              config.flightEnabled,
              signal
            )
          } else {
            // WebSocket-based synthesis: v1 (websocket) or v2 (bidirectional text stream).
            // Provenance is passed via the 'provenance' URL query parameter because the
            // JS SDK's setServiceProperty may not add params to the WebSocket URL.
            const defaultPath = isBidirectional
              ? '/tts/cognitiveservices/websocket/v2'
              : '/cognitiveservices/websocket/v1'
            const endpointUrl = currentEndpoint
              ? new URL(currentEndpoint)
              : new URL(`wss://${region}.tts.speech.microsoft.com${defaultPath}`)
            if (config.flightEnabled) {
              endpointUrl.searchParams.set(SETFEATURE_QUERY_PARAM, PROVENANCE_FLIGHT_NAME)
            }
            if (config.provenanceMode !== undefined) {
              endpointUrl.searchParams.set(PROVENANCE_QUERY_PARAM, config.provenanceMode ? 'true' : 'false')
            }
            console.log(`${isBidirectional ? 'Bidirectional v2' : 'WebSocket'} endpoint with provenance: ${endpointUrl.toString()}`)
            const speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(endpointUrl, subscriptionKey)
            speechConfig.speechSynthesisOutputFormat = OUTPUT_FORMAT_MAP[outputFormat] || SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm

            if (isBidirectional) {
              if (voiceName) {
                speechConfig.speechSynthesisVoiceName = voiceName
              }
              const text = [ssmlData.primaryText, ssmlData.secondaryText].filter(Boolean).join(' ')
              synthesisResult = await synthesizeWithBidirectional(speechConfig, text, config.provenanceMode, outputFormat)
            } else {
              synthesisResult = await synthesizeWithLatencyTracking(speechConfig, ssmlData.ssml, config.provenanceMode, outputFormat)
            }
          }

          const result: TestResult = {
            ssmlIndex: ssmlData.index,
            iteration: iter + 1,
            isTargetEndpoint: config.isTarget,
            ...synthesisResult,
            provenanceMode: config.provenanceMode,
            timestamp: new Date().toISOString(),
          }

          // Drop audio data to save memory unless the caller wants to keep it for download
          if (!keepAudio) {
            result.audioData = undefined
          }

          results.push(result)
          onResult(result)
        } catch (error: any) {
          const result: TestResult = {
            ssmlIndex: ssmlData.index,
            iteration: iter + 1,
            provenanceEnabled: config.provenanceMode === true,
            provenanceMode: config.provenanceMode,
            isTargetEndpoint: config.isTarget,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          }

          results.push(result)
          onResult(result)
        }

        completedTests++

        // Delay between requests (configurable)
        if (apiDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, apiDelay))
        }
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
  baseEndpoint?: string | null  // Base/Master FE endpoint (when useDualEndpoints is true)
  targetEndpoint?: string | null  // Target FE endpoint (when useDualEndpoints is true)
  targetProvenanceEnabled?: boolean | null  // Enable provenance on target FE: true=ON, false=OFF, null=server default
  targetFlightEnabled?: boolean  // Enable ttsfrontend-provenance flight via setfeature query param
  useDualEndpoints?: boolean  // Use different endpoints for Base vs Target
  region: string | null
  outputFormat: string
  protocol?: Protocol  // Synthesis protocol (default 'websocket')
  voiceName?: string  // Voice name, required for bidirectional text streaming (v2)
  onLog: (message: string) => void
  signal: AbortSignal
}

export async function runWarmup(options: WarmupOptions): Promise<void> {
  const { ssml, warmupRuns, subscriptionKey, endpoint, baseEndpoint, targetEndpoint, targetProvenanceEnabled, targetFlightEnabled = false, useDualEndpoints = false, region, outputFormat, protocol = 'websocket', voiceName, onLog, signal } = options

  const isBidirectional = protocol === 'bidirectional'

  // Convert null to undefined for provenanceMode (null means use server default)
  const targetProvenanceMode: ProvenanceMode = targetProvenanceEnabled ?? undefined

  if (warmupRuns <= 0) {
    return
  }

  // Define endpoint configs for warmup: { isTarget, endpoint, provenanceMode, flightEnabled }
  type EndpointConfig = { isTarget: boolean; endpoint: string | null; provenanceMode: ProvenanceMode; flightEnabled: boolean }
  
  const endpointConfigs: EndpointConfig[] = []
  if (useDualEndpoints) {
    // Warmup both base and target endpoints
    endpointConfigs.push({ isTarget: false, endpoint: baseEndpoint || endpoint, provenanceMode: undefined, flightEnabled: false })
    endpointConfigs.push({ isTarget: true, endpoint: targetEndpoint || endpoint, provenanceMode: targetProvenanceMode, flightEnabled: targetFlightEnabled })
  } else {
    // Single endpoint: warmup with server default
    endpointConfigs.push({ isTarget: false, endpoint: endpoint, provenanceMode: undefined, flightEnabled: false })
  }

  onLog(`🔥 Starting warmup (${warmupRuns} runs${useDualEndpoints ? ' for Base/Target' : ''})...`)

  for (let i = 0; i < warmupRuns; i++) {
    for (const config of endpointConfigs) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      try {
        const currentEndpoint = config.endpoint
        const defaultPath = isBidirectional
          ? '/tts/cognitiveservices/websocket/v2'
          : '/cognitiveservices/websocket/v1'

        // Build endpoint URL with provenance parameter directly
        const endpointUrl = currentEndpoint
          ? new URL(currentEndpoint)
          : new URL(`wss://${region}.tts.speech.microsoft.com${defaultPath}`)
        if (config.flightEnabled) {
          endpointUrl.searchParams.set(SETFEATURE_QUERY_PARAM, PROVENANCE_FLIGHT_NAME)
        }
        if (config.provenanceMode !== undefined) {
          endpointUrl.searchParams.set(PROVENANCE_QUERY_PARAM, config.provenanceMode ? 'true' : 'false')
        }
        const speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(endpointUrl, subscriptionKey)

        speechConfig.speechSynthesisOutputFormat = OUTPUT_FORMAT_MAP[outputFormat] || SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm

        if (isBidirectional) {
          if (voiceName) {
            speechConfig.speechSynthesisVoiceName = voiceName
          }
          await synthesizeWithBidirectional(speechConfig, 'Warmup.', config.provenanceMode, outputFormat)
        } else {
          await synthesizeWithLatencyTracking(speechConfig, ssml, config.provenanceMode, outputFormat)
        }
        const label = config.isTarget ? 'Target' : 'Base'
        const provLabel = config.provenanceMode === undefined ? 'default' : config.provenanceMode ? 'ON' : 'OFF'
        const endpointInfo = useDualEndpoints && currentEndpoint ? ` [${new URL(currentEndpoint).host}]` : ''
        onLog(`  ✓ Warmup ${i + 1}/${warmupRuns}, ${label}(prov=${provLabel})${endpointInfo}`)
      } catch (error: any) {
        const label = config.isTarget ? 'Target' : 'Base'
        onLog(`  ✗ Warmup ${i + 1}/${warmupRuns}, ${label}: ${error.message}`)
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  onLog(`🔥 Warmup completed`)
}
