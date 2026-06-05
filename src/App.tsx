import { useState, useCallback, useEffect } from 'react'
import { ConfigPanel } from './components/ConfigPanel'
import { SsmlPreview } from './components/SsmlPreview'
import { ProgressSection } from './components/ProgressSection'
import { ResultsSection } from './components/ResultsSection'
import { AudioList } from './components/AudioList'
import { LogSection } from './components/LogSection'
import { generateSsmls, SsmlData } from './utils/ssmlGenerator'
import { runPerformanceTest, runWarmup, TestResult } from './utils/synthesizer'
import { LogEntry } from './types'
import { loadConfig, saveConfig, clearConfig, TestMode } from './utils/storage'

/**
 * Parse URL parameters to override config.
 * Supported parameters:
 * - provenance: 'true' | 'false' - enable/disable provenance (shortcut for testMode)
 * - testMode: 'default' | 'both' | 'provOff' | 'provOn'
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
    result.testMode = 'provOn'
  } else if (provenance === 'false') {
    result.testMode = 'provOff'
  }

  // testMode can override provenance if both are specified
  const testMode = params.get('testMode')
  if (testMode && ['default', 'both', 'provOff', 'provOn'].includes(testMode)) {
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
  const [subscriptionKey, setSubscriptionKey] = useState(urlParams.key || savedConfig.subscriptionKey || '')
  const [voiceName, setVoiceName] = useState(urlParams.voice || savedConfig.voiceName || 'en-US-AvaNeural')
  const [outputFormat, setOutputFormat] = useState(urlParams.format || savedConfig.outputFormat || 'riff-24khz-16bit-mono-pcm')
  const [ssmlCount, setSsmlCount] = useState(urlParams.ssmlCount || savedConfig.ssmlCount || 50)
  const [iterations, setIterations] = useState(urlParams.iterations || savedConfig.iterations || 1)
  const [warmupRuns, setWarmupRuns] = useState(urlParams.warmup ?? savedConfig.warmupRuns ?? 1)
  const [enableCache, setEnableCache] = useState(savedConfig.enableCache ?? true)
  const [detectUrl, setDetectUrl] = useState(savedConfig.detectUrl || '')
  const [testMode, setTestMode] = useState<TestMode>(urlParams.testMode || savedConfig.testMode || 'both')
  const [useHttpApi, setUseHttpApi] = useState(urlParams.useHttpApi ?? savedConfig.useHttpApi ?? false)

  // SSML state
  const [ssmls, setSsmls] = useState<SsmlData[]>([])

  // Test state
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTest, setCurrentTest] = useState('')
  const [results, setResults] = useState<TestResult[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])

  // Abort controller for stopping tests
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // Save config when values change
  useEffect(() => {
    if (enableCache) {
      saveConfig({
        endpointType,
        region,
        customEndpoint,
        subscriptionKey,
        voiceName,
        outputFormat,
        ssmlCount,
        iterations,
        warmupRuns,
        enableCache,
        detectUrl,
        testMode,
        useHttpApi,
      })
    }
  }, [endpointType, region, customEndpoint, subscriptionKey, voiceName, outputFormat, ssmlCount, iterations, warmupRuns, enableCache, detectUrl, testMode, useHttpApi])

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
    setSubscriptionKey('')
    setVoiceName('en-US-AvaNeural')
    setOutputFormat('riff-24khz-16bit-mono-pcm')
    setSsmlCount(50)
    setIterations(1)
    setWarmupRuns(1)
    setEnableCache(true)
    setDetectUrl('')
    setTestMode('both')
    addLog('🗑️ Cache cleared', 'info')
  }, [addLog])

  const handleGenerateSsmls = useCallback(() => {
    const generated = generateSsmls(ssmlCount, voiceName)
    setSsmls(generated)
    addLog(`✅ Generated ${generated.length} SSMLs with voice: ${voiceName}`, 'success')
  }, [ssmlCount, voiceName, addLog])

  const handleStartTest = useCallback(async () => {
    if (!subscriptionKey) {
      addLog('❌ Please enter a subscription key', 'error')
      return
    }
    if (ssmls.length === 0) {
      addLog('❌ Please generate SSMLs first', 'error')
      return
    }
    if (endpointType === 'custom' && !customEndpoint) {
      addLog('❌ Please enter a custom endpoint', 'error')
      return
    }

    const controller = new AbortController()
    setAbortController(controller)
    setIsRunning(true)
    setResults([])
    setProgress(0)

    const endpoint = endpointType === 'custom' ? customEndpoint : null
    const regionValue = endpointType === 'region' ? region : null

    addLog(`🚀 Starting performance test...`, 'info')
    addLog(`📊 Configuration: ${endpointType === 'custom' ? `Custom: ${customEndpoint}` : `Region: ${region}`}`, 'info')
    addLog(`📝 SSMLs: ${ssmls.length}, Iterations: ${iterations}, Warmup: ${warmupRuns}`, 'info')

    try {
      // Run warmup first
      if (warmupRuns > 0) {
        await runWarmup({
          ssml: ssmls[0].ssml,
          warmupRuns,
          subscriptionKey,
          endpoint,
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
        region: regionValue,
        outputFormat,
        testMode,
        useHttpApi,
        onProgress: (current, total, label) => {
          setProgress((current / total) * 100)
          setCurrentTest(label)
        },
        onResult: (result) => {
          setResults(prev => [...prev, result])
          const status = result.success ? '✓' : '✗'
          const logType = result.success ? 'success' : 'error'
          const msg = result.success
            ? `${status} SSML ${result.ssmlIndex}, Prov=${result.provenanceEnabled ? 'ON' : 'OFF'}: FirstByte=${result.firstByteLatencyMs?.toFixed(1)}ms, LastByte=${result.lastByteLatencyMs?.toFixed(1)}ms`
            : `${status} SSML ${result.ssmlIndex}, Prov=${result.provenanceEnabled ? 'ON' : 'OFF'}: ${result.error}`
          addLog(msg, logType)
        },
        signal: controller.signal,
      })

      addLog('✅ Performance test completed!', 'success')
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addLog('⚠️ Test stopped by user', 'warning')
      } else {
        addLog(`❌ Test failed: ${error.message}`, 'error')
      }
    } finally {
      setIsRunning(false)
      setAbortController(null)
      setCurrentTest('')
    }
  }, [subscriptionKey, ssmls, endpointType, customEndpoint, region, iterations, warmupRuns, outputFormat, testMode, useHttpApi, addLog])

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
          subscriptionKey={subscriptionKey}
          setSubscriptionKey={setSubscriptionKey}
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
          testMode={testMode}
          setTestMode={setTestMode}
          useHttpApi={useHttpApi}
          setUseHttpApi={setUseHttpApi}
          onGenerateSsmls={handleGenerateSsmls}
          onStartTest={handleStartTest}
          onStopTest={handleStopTest}
          onClearCache={handleClearCache}
          isRunning={isRunning}
          hasSsmls={ssmls.length > 0}
        />

        {/* SSML Preview */}
        <SsmlPreview ssmls={ssmls} />

        {/* Progress */}
        {isRunning && (
          <ProgressSection progress={progress} currentTest={currentTest} />
        )}

        {/* Results */}
        {results.length > 0 && !isRunning && (
          <ResultsSection results={results} />
        )}

        {/* Audio List */}
        {results.length > 0 && !isRunning && (
          <AudioList results={results} ssmls={ssmls} detectUrl={detectUrl} outputFormat={outputFormat} />
        )}

        {/* Log */}
        <LogSection logs={logs} onClear={clearLogs} />
      </div>
    </div>
  )
}

export default App
