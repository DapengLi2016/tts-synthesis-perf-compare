import { REGIONS, VOICES, OUTPUT_FORMATS } from '../constants'
import { TestMode, DetectAuthType } from '../utils/storage'
import { useState, useEffect, useCallback } from 'react'
import { generateBlobSasUrlWithToken } from '../utils/blobToken'

interface ConfigPanelProps {
  endpointType: 'region' | 'custom'
  setEndpointType: (v: 'region' | 'custom') => void
  region: string
  setRegion: (v: string) => void
  customEndpoint: string
  setCustomEndpoint: (v: string) => void
  subscriptionKey: string
  setSubscriptionKey: (v: string) => void
  accessToken: string
  setAccessToken: (v: string) => void
  voiceName: string
  setVoiceName: (v: string) => void
  outputFormat: string
  setOutputFormat: (v: string) => void
  ssmlCount: number
  setSsmlCount: (v: number) => void
  iterations: number
  setIterations: (v: number) => void
  warmupRuns: number
  setWarmupRuns: (v: number) => void
  enableCache: boolean
  setEnableCache: (v: boolean) => void
  detectUrl: string
  setDetectUrl: (v: string) => void
  detectAuthType: DetectAuthType
  setDetectAuthType: (v: DetectAuthType) => void
  detectToken: string
  setDetectToken: (v: string) => void
  verifyWatermark: boolean
  setVerifyWatermark: (v: boolean) => void
  testMode: TestMode
  setTestMode: (v: TestMode) => void
  useHttpApi: boolean
  setUseHttpApi: (v: boolean) => void
  // SSML options
  useMultiVoice: boolean
  setUseMultiVoice: (v: boolean) => void
  backgroundAudioUrl: string
  setBackgroundAudioUrl: (v: string) => void
  // Callbacks
  onGenerateSsmls: () => void
  onStartTest: () => void
  onStopTest: () => void
  onClearCache: () => void
  onLog?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  isRunning: boolean
  hasSsmls: boolean
}

export function ConfigPanel({
  endpointType, setEndpointType,
  region, setRegion,
  customEndpoint, setCustomEndpoint,
  subscriptionKey, setSubscriptionKey,
  accessToken, setAccessToken,
  voiceName, setVoiceName,
  outputFormat, setOutputFormat,
  ssmlCount, setSsmlCount,
  iterations, setIterations,
  warmupRuns, setWarmupRuns,
  enableCache, setEnableCache,
  detectUrl, setDetectUrl,
  detectAuthType, setDetectAuthType,
  detectToken, setDetectToken,
  verifyWatermark, setVerifyWatermark,
  testMode, setTestMode,
  useHttpApi, setUseHttpApi,
  useMultiVoice, setUseMultiVoice,
  backgroundAudioUrl, setBackgroundAudioUrl,
  onGenerateSsmls, onStartTest, onStopTest, onClearCache, onLog,
  isRunning, hasSsmls,
}: ConfigPanelProps) {
  // Generate SAS URL state
  const [isGeneratingSas, setIsGeneratingSas] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState(false)

  // Check if URL needs SAS
  const needsSas = backgroundAudioUrl && 
    !backgroundAudioUrl.includes('?') && 
    backgroundAudioUrl.includes('.blob.core.windows.net')

  // CLI command for getting storage token
  const cliCommand = 'az account get-access-token --resource https://storage.azure.com --query accessToken -o tsv'

  const handleCopyCommand = useCallback(() => {
    navigator.clipboard.writeText(cliCommand)
    setCopiedCommand(true)
    setTimeout(() => setCopiedCommand(false), 2000)
  }, [])

  // Auto-generate SAS when accessToken is available and blob URL needs SAS
  useEffect(() => {
    const autoGenerateSas = async () => {
      if (!needsSas || !accessToken || isGeneratingSas) return
      
      try {
        setIsGeneratingSas(true)
        onLog?.('🔑 Auto-generating SAS URL...', 'info')
        const sasUrl = await generateBlobSasUrlWithToken(backgroundAudioUrl, accessToken)
        setBackgroundAudioUrl(sasUrl)
        onLog?.('✅ SAS URL generated successfully!', 'success')
      } catch (error: any) {
        onLog?.(`❌ Failed to generate SAS: ${error.message}`, 'error')
      } finally {
        setIsGeneratingSas(false)
      }
    }

    autoGenerateSas()
  }, [needsSas, accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">⚙️ Configuration</h2>

      {/* Row 1: Endpoint */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block font-semibold mb-1">Endpoint Type:</label>
          <select
            value={endpointType}
            onChange={e => setEndpointType(e.target.value as 'region' | 'custom')}
            className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="region">Azure Region</option>
            <option value="custom">Custom Endpoint</option>
          </select>
        </div>

        {endpointType === 'region' ? (
          <div>
            <label className="block font-semibold mb-1">Region:</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">Custom WebSocket Endpoint:</label>
            <input
              type="text"
              value={customEndpoint}
              onChange={e => setCustomEndpoint(e.target.value)}
              placeholder="ws://localhost:12345/cognitiveservices/websocket/v1"
              className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <small className="text-gray-500 text-sm">e.g., ws://localhost:12345/cognitiveservices/websocket/v1</small>
          </div>
        )}
      </div>

      {/* Row 2: Subscription Key */}
      <div className="mb-4">
        <label className="block font-semibold mb-1">Subscription Key:</label>
        <input
          type="password"
          value={subscriptionKey}
          onChange={e => setSubscriptionKey(e.target.value)}
          placeholder="Enter your Azure Speech subscription key"
          className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Row 2.1: Access Token (optional) */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <label className="block font-semibold mb-1">
          Access Token <span className="text-gray-400 font-normal">(optional)</span>:
        </label>
        <input
          type="password"
          value={accessToken}
          onChange={e => setAccessToken(e.target.value)}
          placeholder="Enter Azure AD access token"
          className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <small className="text-gray-500 text-xs mt-1 block">
          Optional Azure AD token for user identity operations. If provided:
          <br />• Content Safety detect API - Use with Cognitive Services scope
          <br />• Storage blob SAS generation - Use with Storage scope (or click "Generate SAS" button which auto-logins)
        </small>
        <div className="mt-2 p-2 bg-gray-900 rounded-md font-mono text-xs text-green-400 overflow-x-auto flex items-center justify-between gap-2">
          <div className="flex-1 overflow-x-auto">
            <span className="text-gray-500">$</span> az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText('az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv')
              onLog?.('📋 Command copied to clipboard!', 'info')
            }}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs whitespace-nowrap transition-colors"
            title="Copy to clipboard"
          >
            📋 Copy
          </button>
        </div>
      </div>

      {/* Row 2.5: Detect URL (optional) */}
      <div className="mb-4">
        <label className="block font-semibold mb-1">
          Detect API URL <span className="text-gray-400 font-normal">(optional)</span>:
        </label>
        <input
          type="text"
          value={detectUrl}
          onChange={e => setDetectUrl(e.target.value)}
          placeholder="https://your-content-safety.cognitiveservices.azure.com"
          className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <small className="text-gray-500 text-sm">
          Content Safety Provenance detect endpoint. Uses Azure AD or API Key for authentication.
        </small>
      </div>

      {/* Row 2.6: Verify Watermark Option */}
      {detectUrl && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-md">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={verifyWatermark}
              onChange={e => setVerifyWatermark(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="font-medium text-purple-800">🔍 Auto-verify watermark after synthesis</span>
          </label>
          
          {verifyWatermark && (
            <div className="ml-6 space-y-3">
              {/* Auth Type Selection */}
              <div>
                <label className="block font-semibold mb-1 text-sm text-purple-700">Authentication Type:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="detectAuthType"
                      value="apiKey"
                      checked={detectAuthType === 'apiKey'}
                      onChange={() => setDetectAuthType('apiKey')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm">API Key</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="detectAuthType"
                      value="token"
                      checked={detectAuthType === 'token'}
                      onChange={() => setDetectAuthType('token')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm">Access Token (Bearer)</span>
                  </label>
                </div>
              </div>

              {/* Show different UI based on auth type */}
              {detectAuthType === 'token' ? (
                // Access Token mode: use the global access token from above
                accessToken ? (
                  <div className="p-2 bg-green-100 border border-green-300 rounded-md">
                    <span className="text-green-700 text-sm">
                      ✅ Using Access Token from above for watermark verification
                    </span>
                  </div>
                ) : (
                  <div className="p-2 bg-yellow-100 border border-yellow-300 rounded-md">
                    <span className="text-yellow-700 text-sm">
                      ⚠️ Please enter Access Token in the field above (below Subscription Key)
                    </span>
                  </div>
                )
              ) : (
                // API Key mode: show API key input
                <div>
                  <label className="block font-semibold mb-1 text-sm text-purple-700">
                    Detect API Key <span className="text-red-500">*</span>:
                  </label>
                  <input
                    type="password"
                    value={detectToken}
                    onChange={e => setDetectToken(e.target.value)}
                    placeholder="Enter Content Safety API key"
                    className={`w-full p-2 border rounded-md focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${
                      !detectToken ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  <small className="text-gray-500 text-xs">
                    Get from Azure Portal → Content Safety → Keys and Endpoint
                  </small>
                </div>
              )}
            </div>
          )}
          
          <p className="text-sm text-purple-600 mt-2 ml-6">
            When enabled, all provenance-enabled audio will be verified against the detect API after synthesis completes.
          </p>
        </div>
      )}

      {/* Row 3: Voice & Format */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block font-semibold mb-1">Voice Name:</label>
          <select
            value={voiceName}
            onChange={e => setVoiceName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {VOICES.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1">Output Format:</label>
          <select
            value={outputFormat}
            onChange={e => setOutputFormat(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {OUTPUT_FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 4: SSML Count & Iterations & Warmup */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block font-semibold mb-1">Number of SSML Scripts:</label>
          <input
            type="number"
            value={ssmlCount}
            onChange={e => setSsmlCount(parseInt(e.target.value) || 50)}
            min={1}
            max={200}
            className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <small className="text-gray-500 text-sm">Number of different SSML scripts to generate</small>
        </div>

        <div>
          <label className="block font-semibold mb-1">Iterations per SSML:</label>
          <input
            type="number"
            value={iterations}
            onChange={e => setIterations(parseInt(e.target.value) || 1)}
            min={1}
            max={10}
            className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <small className="text-gray-500 text-sm">Run each SSML multiple times for statistical significance</small>
        </div>

        <div>
          <label className="block font-semibold mb-1">Warmup Runs:</label>
          <input
            type="number"
            value={warmupRuns}
            onChange={e => setWarmupRuns(parseInt(e.target.value) || 0)}
            min={0}
            max={10}
            className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <small className="text-gray-500 text-sm">Warmup runs before test (both ON/OFF)</small>
        </div>
      </div>

      {/* Row 4.3: SSML Options */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="font-semibold text-blue-700 mb-3">📝 SSML Options</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          {/* Multi-voice toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useMultiVoice}
              onChange={e => setUseMultiVoice(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span>Use Multi-Voice (2 voice elements)</span>
          </label>
        </div>

        {/* Background Audio URL */}
        <div className="mb-2">
          <label className="block font-semibold mb-1 text-sm">
            Background Audio URL <span className="text-gray-400 font-normal">(optional)</span>:
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              list="bgm-url-options"
              value={backgroundAudioUrl}
              onChange={e => setBackgroundAudioUrl(e.target.value)}
              placeholder="Select from list or enter URL"
              className="flex-1 p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
            <datalist id="bgm-url-options">
              <option value="https://videotranslationpipeline.blob.core.windows.net/users/poleli/bgm/background.mp3" label="Default BGM" />
            </datalist>
            {isGeneratingSas && (
              <span className="text-blue-500 text-sm whitespace-nowrap">⏳ Generating SAS...</span>
            )}
          </div>
          {needsSas && !accessToken && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="text-yellow-700 text-sm mb-2">
                ⚠️ Storage Access Token required. Run this command and paste to "Access Token" field above:
              </div>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-gray-800 text-green-400 text-xs rounded font-mono overflow-x-auto">
                  {cliCommand}
                </code>
                <button
                  onClick={handleCopyCommand}
                  className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 whitespace-nowrap"
                >
                  {copiedCommand ? '✅ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>
          )}
          <small className="text-gray-500 text-xs">
            Only 16kHz/24kHz sample rates support BGM. Select from dropdown or enter a URL with SAS token.
          </small>
        </div>
      </div>

      {/* Row 4.5: Test Mode */}
      <div className="mb-4">
        <label className="block font-semibold mb-1">Test Mode:</label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="testMode"
              value="default"
              checked={testMode === 'default'}
              onChange={() => setTestMode('default')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-gray-600">Default (no header, server decides)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="testMode"
              value="both"
              checked={testMode === 'both'}
              onChange={() => setTestMode('both')}
              className="w-4 h-4 text-blue-600"
            />
            <span>Compare OFF vs ON</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="testMode"
              value="provOff"
              checked={testMode === 'provOff'}
              onChange={() => setTestMode('provOff')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-orange-600">🔓 X-Provenance: false</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="testMode"
              value="provOn"
              checked={testMode === 'provOn'}
              onChange={() => setTestMode('provOn')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-green-700 font-medium">🔒 X-Provenance: true</span>
          </label>
        </div>
      </div>

      {/* Row 4.6: Use HTTP API */}
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useHttpApi}
            onChange={e => setUseHttpApi(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="font-medium">Use HTTP REST API instead of WebSocket SDK</span>
        </label>
        <p className="text-sm text-gray-600 mt-1 ml-6">
          WebSocket SDK uses <code className="bg-gray-200 px-1 rounded">provenance</code> URL query parameter.
          HTTP REST API uses <code className="bg-gray-200 px-1 rounded">X-Microsoft-Provenance-Enabled</code> header.
        </p>
      </div>

      {/* Row 5: Cache Settings */}
      <div className="flex items-center gap-4 mb-6 p-3 bg-gray-50 rounded-md">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enableCache}
            onChange={e => setEnableCache(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm">Cache settings in browser (including subscription key)</span>
        </label>
        <button
          onClick={onClearCache}
          className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          🗑️ Clear Cache
        </button>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onGenerateSsmls}
          disabled={isRunning}
          className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          📝 Generate SSMLs
        </button>
        <button
          onClick={onStartTest}
          disabled={isRunning || !hasSsmls}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ▶️ Start Performance Test
        </button>
        <button
          onClick={onStopTest}
          disabled={!isRunning}
          className="px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ⏹️ Stop
        </button>
      </div>
    </div>
  )
}
