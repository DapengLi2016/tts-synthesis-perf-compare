import { useState, useCallback, useEffect } from 'react'
import { ConfigPanel } from './components/ConfigPanel'
import { SsmlPreview } from './components/SsmlPreview'
import { ProgressSection } from './components/ProgressSection'
import { ResultsSection } from './components/ResultsSection'
import { AudioList } from './components/AudioList'
import { LogSection } from './components/LogSection'
import { generateSsmls, SsmlData } from './utils/ssmlGenerator'
import { runPerformanceTest, runWarmup, TestResult } from './utils/synthesizer'
import { detectWatermarkWithKey, detectWatermarkWithToken, DetectResult, isRawFormat, parseAudioFormat, addWavHeader } from './utils/detect'
import { LogEntry } from './types'
import { loadConfig, saveConfig, clearConfig, TestMode, DetectAuthType, TestOrder } from './utils/storage'

/**
 * Parse URL parameters to override config.
 * Supported parameters:
 * - provenance: 'true' | 'false' - enable/disable provenance (shortcut for testMode)
 * - testMode: 'default' | 'compare' | 'base' | 'target'
 * - endpoint: custom WebSocket endpoint URL
 * - region: Azure region (e.g., 'eastus')
 * - voice: voice name (e.g., 'en-US-AvaNeural')
 * - format: output format (e.g., 'riff-24khz-16bit-mono-pcm')
 * - ssmlCount: number of SSMLs to generate
 * - iterations: iterations per SSML
 * - warmup: warmup runs
 * - useHttpApi: 'true' | 'false' - use HTTP API instead of WebSocket
 * - key: subscription key (not recommended for URLs)
 */
function parseUrlParams(): Partial<{
  testMode: TestMode
  endpoint: string
  region: string
  voice: string
  format: string
  ssmlCount: number
  iterations: number
  warmup: number
  useHttpApi: boolean
  key: string
}> {
  const params = new URLSearchParams(window.location.search)
  const result: ReturnType<typeof parseUrlParams> = {}

  // Check 'provenance' parameter first (shortcut for testMode)
  const provenance = params.get('provenance')?.toLowerCase()
  if (provenance === 'true') {
    result.testMode = 'target'  // Target with provenance enabled
  } else if (provenance === 'false') {
    result.testMode = 'base'  // Base only
  }

  // testMode can override provenance if both are specified
  const testMode = params.get('testMode')
  if (testMode && ['default', 'compare', 'base', 'target'].includes(testMode)) {
    result.testMode = testMode as TestMode
  }

  const endpoint = params.get('endpoint')
  if (endpoint) result.endpoint = endpoint

  const region = params.get('region')
  if (region) result.region = region

  const voice = params.get('voice')
  if (voice) result.voice = voice

  const format = params.get('format')
  if (format) result.format = format

  const ssmlCount = params.get('ssmlCount')
  if (ssmlCount) result.ssmlCount = parseInt(ssmlCount) || undefined

  const iterations = params.get('iterations')
  if (iterations) result.iterations = parseInt(iterations) || undefined

  const warmup = params.get('warmup')
  if (warmup !== null) result.warmup = parseInt(warmup) || 0

  const useHttpApi = params.get('useHttpApi')
  if (useHttpApi === 'true') result.useHttpApi = true
  if (useHttpApi === 'false') result.useHttpApi = false

  const key = params.get('key')
  if (key) result.key = key

  return result
}

function App() {
  // Load saved config and URL params (URL params take precedence)
  const savedConfig = loadConfig()
  const urlParams = parseUrlParams()

  // Config state (URL params override saved config)
  const [endpointType, setEndpointType] = useState<'region' | 'custom'>(
    urlParams.endpoint ? 'custom' : (savedConfig.endpointType || 'region')
  )
  const [region, setRegion] = useState(urlParams.region || savedConfig.region || 'eastus')
  const [customEndpoint, setCustomEndpoint] = useState(urlParams.endpoint || savedConfig.customEndpoint || 'ws://localhost:12345/cognitiveservices/websocket/v1')
  const [useDualEndpoints, setUseDualEndpoints] = useState(savedConfig.useDualEndpoints ?? false)
  const [baseEndpoint, setBaseEndpoint] = useState(savedConfig.baseEndpoint || '')
  const [targetEndpoint, setTargetEndpoint] = useState(savedConfig.targetEndpoint || '')
  const [targetProvenanceEnabled, setTargetProvenanceEnabled] = useState<boolean | null>(savedConfig.targetProvenanceEnabled ?? null)
  const [targetFlightEnabled, setTargetFlightEnabled] = useState(savedConfig.targetFlightEnabled ?? false)
  const [subscriptionKey, setSubscriptionKey] = useState(urlParams.key || savedConfig.subscriptionKey || '')
  const [accessToken, setAccessToken] = useState(savedConfig.accessToken || '')
  const [voiceName, setVoiceName] = useState(urlParams.voice || savedConfig.voiceName || 'en-US-AvaNeural')
  const [outputFormat, setOutputFormat] = useState(urlParams.format || savedConfig.outputFormat || 'riff-24khz-16bit-mono-pcm')
  const [ssmlCount, setSsmlCount] = useState(urlParams.ssmlCount || savedConfig.ssmlCount || 50)
  const [iterations, setIterations] = useState(urlParams.iterations || savedConfig.iterations || 1)
  const [warmupRuns, setWarmupRuns] = useState(urlParams.warmup ?? savedConfig.warmupRuns ?? 1)
  const [enableCache, setEnableCache] = useState(savedConfig.enableCache ?? true)
  const [detectUrl, setDetectUrl] = useState(savedConfig.detectUrl || '')
  const [detectAuthType, setDetectAuthType] = useState<DetectAuthType>(savedConfig.detectAuthType || 'apiKey')
  const [detectToken, setDetectToken] = useState(savedConfig.detectToken || '')
  const [verifyWatermark, setVerifyWatermark] = useState(savedConfig.verifyWatermark ?? false)
  const [detectMaxCount, setDetectMaxCount] = useState(savedConfig.detectMaxCount ?? 3)
  const [testMode, setTestMode] = useState<TestMode>(urlParams.testMode || savedConfig.testMode || 'compare')
  const [testOrder, setTestOrder] = useState<TestOrder>(savedConfig.testOrder || 'baseFirst')
  const [apiDelay, setApiDelay] = useState(savedConfig.apiDelay ?? 100)
  const [useHttpApi, setUseHttpApi] = useState(urlParams.useHttpApi ?? savedConfig.useHttpApi ?? false)
  
  // SSML options
  const [useMultiVoice, setUseMultiVoice] = useState(savedConfig.useMultiVoice ?? true)
  const [backgroundAudioUrl, setBackgroundAudioUrl] = useState(savedConfig.backgroundAudioUrl || '')
  const [inlineAudioUrl, setInlineAudioUrl] = useState(savedConfig.inlineAudioUrl || 'https://videotranslationpipeline.blob.core.windows.net/users/poleli/bgm/audio-tag-sample.wav')
  const [bgmSasToken, setBgmSasToken] = useState(savedConfig.bgmSasToken || '')
  const [inlineAudioSasToken, setInlineAudioSasToken] = useState(savedConfig.inlineAudioSasToken || '')

  // SSML state
  const [ssmls, setSsmls] = useState<SsmlData[]>([])

  // Test state
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTest, setCurrentTest] = useState('')
  const [results, setResults] = useState<TestResult[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyProgress, setVerifyProgress] = useState({ current: 0, total: 0 })
  const [autoDetectResults, setAutoDetectResults] = useState<Record<string, DetectResult>>({})

  // Abort controller for stopping tests
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // Save config when values change
  useEffect(() => {
    if (enableCache) {
      saveConfig({
        endpointType,
        region,
        customEndpoint,
        useDualEndpoints,
        baseEndpoint,
        targetEndpoint,
        targetProvenanceEnabled,
        targetFlightEnabled,
        subscriptionKey,
        accessToken,
        voiceName,
        outputFormat,
        ssmlCount,
        iterations,
        warmupRuns,
        enableCache,
        detectUrl,
        detectAuthType,
        detectToken,
        verifyWatermark,
        detectMaxCount,
        testMode,
        testOrder,
        apiDelay,
        useHttpApi,
        useMultiVoice,
        backgroundAudioUrl,
        inlineAudioUrl,
        bgmSasToken,
        inlineAudioSasToken,
      })
    }
  }, [endpointType, region, customEndpoint, useDualEndpoints, baseEndpoint, targetEndpoint, targetProvenanceEnabled, targetFlightEnabled, subscriptionKey, accessToken, voiceName, outputFormat, ssmlCount, iterations, warmupRuns, enableCache, detectUrl, detectAuthType, detectToken, verifyWatermark, detectMaxCount, testMode, testOrder, apiDelay, useHttpApi, useMultiVoice, backgroundAudioUrl, inlineAudioUrl, bgmSasToken, inlineAudioSasToken])

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date(), message, type }])
  }, [])

  // Log URL params on mount
  useEffect(() => {
    const appliedParams = Object.entries(urlParams).filter(([, v]) => v !== undefined)
    if (appliedParams.length > 0) {
      const paramStr = appliedParams.map(([k, v]) => `${k}=${v}`).join(', ')
      setLogs(prev => [...prev, { 
        timestamp: new Date(), 
        message: `🔗 URL params applied: ${paramStr}`, 
        type: 'info' 
      }])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearCache = useCallback(() => {
    clearConfig()
    // Reset to defaults
    setEndpointType('region')
    setRegion('eastus')
    setCustomEndpoint('ws://localhost:12345/cognitiveservices/websocket/v1')
    setUseDualEndpoints(false)
    setBaseEndpoint('')
    setTargetEndpoint('')
    setTargetProvenanceEnabled(null)
    setTargetFlightEnabled(false)
    setSubscriptionKey('')
    setAccessToken('')
    setVoiceName('en-US-AvaNeural')
    setOutputFormat('riff-24khz-16bit-mono-pcm')
    setSsmlCount(50)
    setIterations(1)
    setWarmupRuns(1)
    setEnableCache(true)
    setDetectUrl('')
    setDetectAuthType('apiKey')
    setDetectToken('')
    setVerifyWatermark(false)
    setTestMode('compare')
    setTestOrder('baseFirst')
    setApiDelay(100)
    setUseMultiVoice(true)
    setBackgroundAudioUrl('')
    setInlineAudioUrl('https://videotranslationpipeline.blob.core.windows.net/users/poleli/bgm/audio-tag-sample.wav')
    addLog('🗑️ Cache cleared', 'info')
  }, [addLog])

  const handleGenerateSsmls = useCallback(() => {
    const generated = generateSsmls({
      count: ssmlCount,
      voiceName,
      useMultiVoice,
      backgroundAudioUrl: backgroundAudioUrl || undefined,
      inlineAudioUrl: inlineAudioUrl || undefined,
      bgmSasToken: bgmSasToken || undefined,
      inlineAudioSasToken: inlineAudioSasToken || undefined,
    })
    setSsmls(generated)
    const bgmInfo = backgroundAudioUrl ? `, BGM: enabled` : ''
    const inlineAudioInfo = inlineAudioUrl ? `, Inline Audio: enabled` : ''
    addLog(`✅ Generated ${generated.length} SSMLs with voice: ${voiceName}, Multi-voice: ${useMultiVoice}${bgmInfo}${inlineAudioInfo}`, 'success')
  }, [ssmlCount, voiceName, useMultiVoice, backgroundAudioUrl, inlineAudioUrl, bgmSasToken, inlineAudioSasToken, addLog])

  const handleStartTest = useCallback(async () => {
    if (!subscriptionKey) {
      addLog('❌ Please enter a subscription key', 'error')
      return
    }
    if (ssmls.length === 0) {
      addLog('❌ Please generate SSMLs first', 'error')
      return
    }
    if (endpointType === 'custom' && !useDualEndpoints && !customEndpoint) {
      addLog('❌ Please enter a custom endpoint', 'error')
      return
    }
    if (endpointType === 'custom' && useDualEndpoints) {
      // Validate dual endpoints based on test mode
      if ((testMode === 'base' || testMode === 'compare') && !baseEndpoint) {
        addLog('❌ Please enter the Base endpoint', 'error')
        return
      }
      if ((testMode === 'target' || testMode === 'compare') && !targetEndpoint) {
        addLog('❌ Please enter the Target endpoint', 'error')
        return
      }
    }
    // Check authentication for watermark verification
    if (verifyWatermark) {
      if (detectAuthType === 'token' && !accessToken) {
        addLog('❌ Watermark verification requires Access Token (please fill in the Access Token field above)', 'error')
        return
      }
      if (detectAuthType === 'apiKey' && !detectToken) {
        addLog('❌ Watermark verification requires Detect API Key', 'error')
        return
      }
      if (!detectUrl) {
        addLog('❌ Watermark verification is enabled but no Detect URL provided', 'error')
        return
      }
    }

    const controller = new AbortController()
    setAbortController(controller)
    setIsRunning(true)
    setResults([])
    setAutoDetectResults({})
    setProgress(0)

    const endpoint = endpointType === 'custom' ? customEndpoint : null
    const regionValue = endpointType === 'region' ? region : null

    addLog(`🚀 Starting performance test...`, 'info')
    if (useDualEndpoints && endpointType === 'custom') {
      addLog(`📊 Configuration: Custom Dual Endpoints`, 'info')
      addLog(`   🏠 Base: ${baseEndpoint || '(not set)'}`, 'info')
      addLog(`   🎯 Target: ${targetEndpoint || '(not set)'} (Provenance: ${targetProvenanceEnabled === null ? 'default' : targetProvenanceEnabled ? 'ON' : 'OFF'}, Flight: ${targetFlightEnabled ? 'ON' : 'OFF'})`, 'info')
    } else {
      addLog(`📊 Configuration: ${endpointType === 'custom' ? `Custom: ${customEndpoint}` : `Region: ${region}`}`, 'info')
    }
    addLog(`📝 SSMLs: ${ssmls.length}, Iterations: ${iterations}, Warmup: ${warmupRuns}`, 'info')
    if (verifyWatermark) {
      addLog(`🔍 Watermark verification: ENABLED`, 'info')
    }

    // Collect results during test for verification
    const collectedResults: TestResult[] = []

    try {
      // Run warmup first
      if (warmupRuns > 0) {
        await runWarmup({
          ssml: ssmls[0].ssml,
          warmupRuns,
          subscriptionKey,
          endpoint,
          baseEndpoint: useDualEndpoints ? baseEndpoint : null,
          targetEndpoint: useDualEndpoints ? targetEndpoint : null,
          targetProvenanceEnabled: targetProvenanceEnabled ?? undefined,
          targetFlightEnabled,
          useDualEndpoints: useDualEndpoints && endpointType === 'custom',
          region: regionValue,
          outputFormat,
          onLog: (msg) => addLog(msg, 'info'),
          signal: controller.signal,
        })
      }

      const testResults = await runPerformanceTest({
        ssmls,
        iterations,
        subscriptionKey,
        endpoint,
        baseEndpoint: useDualEndpoints ? baseEndpoint : null,
        targetEndpoint: useDualEndpoints ? targetEndpoint : null,
        targetProvenanceEnabled: targetProvenanceEnabled ?? undefined,
        targetFlightEnabled,
        useDualEndpoints: useDualEndpoints && endpointType === 'custom',
        region: regionValue,
        outputFormat,
        testMode,
        testOrder,
        apiDelay,
        useHttpApi,
        onProgress: (current, total, label) => {
          setProgress((current / total) * 100)
          setCurrentTest(label)
        },
        onResult: (result) => {
          collectedResults.push(result)
          setResults(prev => [...prev, result])
          const status = result.success ? '✓' : '✗'
          const logType = result.success ? 'success' : 'error'
          const endpointLabel = result.isTargetEndpoint ? 'Target' : 'Base'
          const provLabel = result.provenanceEnabled ? 'prov=ON' : result.provenanceEnabled === false ? 'prov=OFF' : 'prov=default'
          const msg = result.success
            ? `${status} SSML ${result.ssmlIndex}, ${endpointLabel}(${provLabel}): FirstByte=${result.firstByteLatencyMs?.toFixed(1)}ms, LastByte=${result.lastByteLatencyMs?.toFixed(1)}ms`
            : `${status} SSML ${result.ssmlIndex}, ${endpointLabel}(${provLabel}): ${result.error}`
          addLog(msg, logType)
        },
        signal: controller.signal,
      })

      addLog('✅ Performance test completed!', 'success')

      // Run watermark verification if enabled
      // Check if we have the required token based on auth type
      const hasRequiredToken = detectAuthType === 'token' ? !!accessToken : !!detectToken
      if (verifyWatermark && detectUrl && hasRequiredToken) {
        const provOnResults = collectedResults.filter(r => r.success && r.provenanceEnabled && r.audioData)
        // Limit to detectMaxCount if set (0 = all)
        const resultsToVerify = detectMaxCount > 0 ? provOnResults.slice(0, detectMaxCount) : provOnResults
        if (resultsToVerify.length > 0) {
          setIsVerifying(true)
          setVerifyProgress({ current: 0, total: resultsToVerify.length })
          if (detectMaxCount > 0 && provOnResults.length > detectMaxCount) {
            addLog(`🔍 Starting watermark verification for ${resultsToVerify.length} of ${provOnResults.length} audio files (limited to ${detectMaxCount})...`, 'info')
          } else {
            addLog(`🔍 Starting watermark verification for ${resultsToVerify.length} audio files...`, 'info')
          }

          // Determine MIME type from output format
          const mimeType = outputFormat.includes('mp3') ? 'audio/mpeg' : 'audio/wav'
          
          // Check if raw format needs WAV header
          const needsWavHeader = isRawFormat(outputFormat)
          const audioParams = needsWavHeader ? parseAudioFormat(outputFormat) : null
          if (needsWavHeader) {
            addLog(`📝 Raw PCM format detected, will add WAV header (${audioParams!.sampleRate}Hz, ${audioParams!.bitsPerSample}bit, ${audioParams!.channels}ch)`, 'info')
          }

          let verified = 0
          let failed = 0
          const maxRetries = 3
          const retryDelayMs = 5000

          for (let i = 0; i < resultsToVerify.length; i++) {
            const result = resultsToVerify[i]
            setVerifyProgress({ current: i + 1, total: resultsToVerify.length })
            setCurrentTest(`Verifying SSML ${result.ssmlIndex} (${i + 1}/${resultsToVerify.length})`)

            // Add WAV header if raw format
            let audioData = result.audioData!
            if (needsWavHeader && audioParams) {
              audioData = addWavHeader(audioData, audioParams.sampleRate, audioParams.bitsPerSample, audioParams.channels)
            }

            let detectResult: DetectResult | null = null
            let lastError: any = null
            
            // Retry loop for detect
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              try {
                // Use accessToken for Bearer auth, detectToken for API Key auth
                detectResult = detectAuthType === 'token'
                  ? await detectWatermarkWithToken(detectUrl, accessToken, audioData, mimeType)
                  : await detectWatermarkWithKey(detectUrl, detectToken, audioData, mimeType)
                
                // If successful detection or expected "no watermark" result, break out of retry loop
                // FailureNoProvenanceNoWatermark is a normal result (audio has no watermark, which is expected for prov-off)
                if (detectResult.status === 'Detected' || 
                    detectResult.status === 'Success' || 
                    detectResult.status === 'SuccessByWatermarkExtraction' ||
                    detectResult.status === 'FailureNoProvenanceNoWatermark') {
                  break
                }
                
                // If not detected or error, retry
                if (attempt < maxRetries - 1) {
                  addLog(`⏳ SSML ${result.ssmlIndex}: ${detectResult.status}, retrying (${attempt + 1}/${maxRetries})...`, 'info')
                  await new Promise(resolve => setTimeout(resolve, retryDelayMs))
                }
              } catch (error: any) {
                lastError = error
                if (attempt < maxRetries - 1) {
                  addLog(`⏳ SSML ${result.ssmlIndex}: Error "${error.message}", retrying (${attempt + 1}/${maxRetries})...`, 'info')
                  await new Promise(resolve => setTimeout(resolve, retryDelayMs))
                }
              }
            }
            
            // Store the detect result
            const key = `${result.ssmlIndex}-${result.iteration}-${result.provenanceEnabled}`
            
            if (detectResult) {
              setAutoDetectResults(prev => ({ ...prev, [key]: detectResult! }))

              if (detectResult.status === 'Detected' || detectResult.status === 'Success' || detectResult.status === 'SuccessByWatermarkExtraction') {
                verified++
                addLog(`✅ SSML ${result.ssmlIndex}: Watermark detected (UUID: ${detectResult.publicUUID || 'N/A'})`, 'success')
              } else if (detectResult.status === 'FailureNoProvenanceNoWatermark') {
                // This is a normal/expected result - no watermark because provenance was not enabled
                verified++
                addLog(`ℹ️ SSML ${result.ssmlIndex}: No watermark (FailureNoProvenanceNoWatermark - expected for prov-off)`, 'info')
              } else if (detectResult.status === 'Error') {
                failed++
                addLog(`❌ SSML ${result.ssmlIndex}: Detection error - ${detectResult.error}`, 'error')
              } else {
                failed++
                addLog(`⚠️ SSML ${result.ssmlIndex}: Watermark NOT detected (status: ${detectResult.status})`, 'warning')
              }
            } else {
              failed++
              addLog(`❌ SSML ${result.ssmlIndex}: Detection failed after ${maxRetries} retries - ${lastError?.message}`, 'error')
              setAutoDetectResults(prev => ({ ...prev, [key]: { status: 'Error', error: lastError?.message || 'Unknown error' } }))
            }
            
            // Add delay between detect calls (detect API is slow and may rate limit)
            if (i < resultsToVerify.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 3000))
            }
          }

          addLog(`🔍 Verification complete: ${verified} verified, ${failed} failed out of ${provOnResults.length}`, 
            failed === 0 ? 'success' : 'warning')
          setIsVerifying(false)
        } else {
          addLog('⚠️ No provenance-enabled audio to verify', 'warning')
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addLog('⚠️ Test stopped by user', 'warning')
      } else {
        addLog(`❌ Test failed: ${error.message}`, 'error')
      }
    } finally {
      setIsRunning(false)
      setIsVerifying(false)
      setAbortController(null)
      setCurrentTest('')
    }
  }, [subscriptionKey, accessToken, ssmls, endpointType, customEndpoint, useDualEndpoints, baseEndpoint, targetEndpoint, region, iterations, warmupRuns, outputFormat, testMode, testOrder, apiDelay, useHttpApi, verifyWatermark, detectMaxCount, detectUrl, detectAuthType, detectToken, addLog])

  const handleStopTest = useCallback(() => {
    abortController?.abort()
  }, [abortController])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  return (
    <div className="min-h-screen p-5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 p-6 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold mb-2">🔬 TTS Provenance Performance Comparison</h1>
          <p className="opacity-90">Compare latency with/without Provenance watermarking via WebSocket</p>
        </header>

        {/* Config Panel */}
        <ConfigPanel
          endpointType={endpointType}
          setEndpointType={setEndpointType}
          region={region}
          setRegion={setRegion}
          customEndpoint={customEndpoint}
          setCustomEndpoint={setCustomEndpoint}
          useDualEndpoints={useDualEndpoints}
          setUseDualEndpoints={setUseDualEndpoints}
          baseEndpoint={baseEndpoint}
          setBaseEndpoint={setBaseEndpoint}
          targetEndpoint={targetEndpoint}
          setTargetEndpoint={setTargetEndpoint}
          targetProvenanceEnabled={targetProvenanceEnabled}
          setTargetProvenanceEnabled={setTargetProvenanceEnabled}
          targetFlightEnabled={targetFlightEnabled}
          setTargetFlightEnabled={setTargetFlightEnabled}
          subscriptionKey={subscriptionKey}
          setSubscriptionKey={setSubscriptionKey}
          accessToken={accessToken}
          setAccessToken={setAccessToken}
          voiceName={voiceName}
          setVoiceName={setVoiceName}
          outputFormat={outputFormat}
          setOutputFormat={setOutputFormat}
          ssmlCount={ssmlCount}
          setSsmlCount={setSsmlCount}
          iterations={iterations}
          setIterations={setIterations}
          warmupRuns={warmupRuns}
          setWarmupRuns={setWarmupRuns}
          enableCache={enableCache}
          setEnableCache={setEnableCache}
          detectUrl={detectUrl}
          setDetectUrl={setDetectUrl}
          detectAuthType={detectAuthType}
          setDetectAuthType={setDetectAuthType}
          detectToken={detectToken}
          setDetectToken={setDetectToken}
          verifyWatermark={verifyWatermark}
          setVerifyWatermark={setVerifyWatermark}
          detectMaxCount={detectMaxCount}
          setDetectMaxCount={setDetectMaxCount}
          testMode={testMode}
          setTestMode={setTestMode}
          testOrder={testOrder}
          setTestOrder={setTestOrder}
          apiDelay={apiDelay}
          setApiDelay={setApiDelay}
          useHttpApi={useHttpApi}
          setUseHttpApi={setUseHttpApi}
          useMultiVoice={useMultiVoice}
          setUseMultiVoice={setUseMultiVoice}
          backgroundAudioUrl={backgroundAudioUrl}
          setBackgroundAudioUrl={setBackgroundAudioUrl}
          inlineAudioUrl={inlineAudioUrl}
          setInlineAudioUrl={setInlineAudioUrl}
          bgmSasToken={bgmSasToken}
          setBgmSasToken={setBgmSasToken}
          inlineAudioSasToken={inlineAudioSasToken}
          setInlineAudioSasToken={setInlineAudioSasToken}
          onGenerateSsmls={handleGenerateSsmls}
          onStartTest={handleStartTest}
          onStopTest={handleStopTest}
          onClearCache={handleClearCache}
          onLog={addLog}
          isRunning={isRunning}
          hasSsmls={ssmls.length > 0}
        />

        {/* SSML Preview */}
        <SsmlPreview ssmls={ssmls} />

        {/* Progress */}
        {(isRunning || isVerifying) && (
          <ProgressSection 
            progress={isVerifying ? (verifyProgress.current / verifyProgress.total) * 100 : progress} 
            currentTest={isVerifying ? `🔍 Verifying: ${currentTest}` : currentTest}
            isVerifying={isVerifying}
          />
        )}

        {/* Results */}
        {results.length > 0 && !isRunning && !isVerifying && (
          <ResultsSection results={results} autoDetectResults={autoDetectResults} />
        )}

        {/* Audio List */}
        {results.length > 0 && !isRunning && !isVerifying && (
          <AudioList results={results} ssmls={ssmls} detectUrl={detectUrl} outputFormat={outputFormat} autoDetectResults={autoDetectResults} detectAuthType={detectAuthType} detectToken={detectToken} accessToken={accessToken} />
        )}

        {/* Log */}
        <LogSection logs={logs} onClear={clearLogs} />
      </div>
    </div>
  )
}

export default App
