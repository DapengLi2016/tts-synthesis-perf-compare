import { REGIONS, VOICES, OUTPUT_FORMATS } from '../constants'
import { TestMode } from '../utils/storage'

interface ConfigPanelProps {
  endpointType: 'region' | 'custom'
  setEndpointType: (v: 'region' | 'custom') => void
  region: string
  setRegion: (v: string) => void
  customEndpoint: string
  setCustomEndpoint: (v: string) => void
  subscriptionKey: string
  setSubscriptionKey: (v: string) => void
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
  testMode: TestMode
  setTestMode: (v: TestMode) => void
  useHttpApi: boolean
  setUseHttpApi: (v: boolean) => void
  onGenerateSsmls: () => void
  onStartTest: () => void
  onStopTest: () => void
  onClearCache: () => void
  isRunning: boolean
  hasSsmls: boolean
}

export function ConfigPanel({
  endpointType, setEndpointType,
  region, setRegion,
  customEndpoint, setCustomEndpoint,
  subscriptionKey, setSubscriptionKey,
  voiceName, setVoiceName,
  outputFormat, setOutputFormat,
  ssmlCount, setSsmlCount,
  iterations, setIterations,
  warmupRuns, setWarmupRuns,
  enableCache, setEnableCache,
  detectUrl, setDetectUrl,
  testMode, setTestMode,
  useHttpApi, setUseHttpApi,
  onGenerateSsmls, onStartTest, onStopTest, onClearCache,
  isRunning, hasSsmls,
}: ConfigPanelProps) {
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
          Content Safety Provenance detect endpoint. Uses Azure AD (current user) for authentication.
        </small>
      </div>

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
          <small className="text-gray-500 text-sm">Each SSML has 2 voice segments with same voice</small>
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
