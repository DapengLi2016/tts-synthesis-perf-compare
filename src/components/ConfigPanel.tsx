import { VOICES, OUTPUT_FORMATS, PRESET_ENDPOINTS, REGION_PRESET_ENDPOINTS, ALL_PRESET_ENDPOINTS, PROTOCOL_LABELS, PROTOCOL_DEFAULT_PATHS, buildProtocolEndpoint } from '../constants'
import { TestMode, DetectAuthType, TestOrder, Protocol, loadEndpointHistory, addEndpointHistory } from '../utils/storage'
import { useState, useCallback, useMemo, useEffect } from 'react'

// Renders the preset <option> groups (local + Azure regions) shared by the
// single/base/target endpoint selectors.
function EndpointPresetOptions() {
  return (
    <>
      <option value="">-- Select preset --</option>
      <optgroup label="Local">
        {PRESET_ENDPOINTS.map(ep => (
          <option key={ep.value} value={ep.value}>{ep.label}</option>
        ))}
      </optgroup>
      <optgroup label="Azure Regions">
        {REGION_PRESET_ENDPOINTS.map(ep => (
          <option key={ep.value} value={ep.value}>{ep.label}</option>
        ))}
      </optgroup>
    </>
  )
}

interface ConfigPanelProps {
  endpointType: 'region' | 'custom'
  setEndpointType: (v: 'region' | 'custom') => void
  region: string
  setRegion: (v: string) => void
  customEndpoint: string
  setCustomEndpoint: (v: string) => void
  onCustomEndpointCommit?: (url: string) => void
  useDualEndpoints: boolean
  setUseDualEndpoints: (v: boolean) => void
  baseEndpoint: string
  setBaseEndpoint: (v: string) => void
  targetEndpoint: string
  setTargetEndpoint: (v: string) => void
  targetProvenanceEnabled: boolean | null
  setTargetProvenanceEnabled: (v: boolean | null) => void
  targetFlightEnabled: boolean
  setTargetFlightEnabled: (v: boolean) => void
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
  keepAudio: boolean
  setKeepAudio: (v: boolean) => void
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
  detectMaxCount: number
  setDetectMaxCount: (v: number) => void
  testMode: TestMode
  setTestMode: (v: TestMode) => void
  testOrder: TestOrder
  setTestOrder: (v: TestOrder) => void
  apiDelay: number
  setApiDelay: (v: number) => void
  protocol: Protocol
  setProtocol: (v: Protocol) => void
  // SSML options
  useMultiVoice: boolean
  setUseMultiVoice: (v: boolean) => void
  backgroundAudioUrl: string
  setBackgroundAudioUrl: (v: string) => void
  inlineAudioUrl: string
  setInlineAudioUrl: (v: string) => void
  bgmSasToken: string
  setBgmSasToken: (v: string) => void
  inlineAudioSasToken: string
  setInlineAudioSasToken: (v: string) => void
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
  onCustomEndpointCommit,
  useDualEndpoints, setUseDualEndpoints,
  baseEndpoint, setBaseEndpoint,
  targetEndpoint, setTargetEndpoint,
  targetProvenanceEnabled, setTargetProvenanceEnabled,
  targetFlightEnabled, setTargetFlightEnabled,
  subscriptionKey, setSubscriptionKey,
  accessToken, setAccessToken,
  voiceName, setVoiceName,
  outputFormat, setOutputFormat,
  ssmlCount, setSsmlCount,
  iterations, setIterations,
  warmupRuns, setWarmupRuns,
  keepAudio, setKeepAudio,
  enableCache, setEnableCache,
  detectUrl, setDetectUrl,
  detectAuthType, setDetectAuthType,
  detectToken, setDetectToken,
  verifyWatermark, setVerifyWatermark,
  detectMaxCount, setDetectMaxCount,
  testMode, setTestMode,
  testOrder, setTestOrder,
  apiDelay, setApiDelay,
  protocol, setProtocol,
  useMultiVoice, setUseMultiVoice,
  backgroundAudioUrl, setBackgroundAudioUrl,
  inlineAudioUrl, setInlineAudioUrl,
  bgmSasToken, setBgmSasToken,
  inlineAudioSasToken, setInlineAudioSasToken,
  onGenerateSsmls, onStartTest, onStopTest, onClearCache, onLog,
  isRunning, hasSsmls,
}: ConfigPanelProps) {
  // Generate SAS URL state
  const [copiedBgmCommand, setCopiedBgmCommand] = useState(false)
  const [copiedInlineCommand, setCopiedInlineCommand] = useState(false)
  const [copiedBgmUrl, setCopiedBgmUrl] = useState(false)
  const [copiedInlineUrl, setCopiedInlineUrl] = useState(false)

  // Toggle to reveal the subscription key in plain text.
  const [showSubKey, setShowSubKey] = useState(false)

  // History of user-entered custom endpoint URLs (not in the preset list),
  // persisted per-protocol in localStorage and offered as a datalist dropdown.
  const [endpointHistory, setEndpointHistory] = useState<string[]>(() => loadEndpointHistory(protocol))

  // Reload history whenever the active protocol changes (each protocol keeps its own list).
  useEffect(() => {
    setEndpointHistory(loadEndpointHistory(protocol))
  }, [protocol])

  // Commit a typed URL to history when it's a non-empty, non-preset value.
  const commitEndpointHistory = useCallback((url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    if (ALL_PRESET_ENDPOINTS.some(p => p.value === trimmed)) return
    setEndpointHistory(addEndpointHistory(protocol, trimmed))
  }, [protocol])

  // Switching protocol rewrites the endpoint(s) to the new protocol's default path,
  // preserving the existing host:port where possible.
  const handleProtocolChange = useCallback((newProtocol: Protocol) => {
    setProtocol(newProtocol)
    if (useDualEndpoints) {
      setBaseEndpoint(buildProtocolEndpoint(baseEndpoint, newProtocol, 'localhost:12345'))
      setTargetEndpoint(buildProtocolEndpoint(targetEndpoint, newProtocol, 'localhost:12346'))
    } else {
      setCustomEndpoint(buildProtocolEndpoint(customEndpoint, newProtocol))
    }
  }, [setProtocol, useDualEndpoints, baseEndpoint, targetEndpoint, customEndpoint, setBaseEndpoint, setTargetEndpoint, setCustomEndpoint])

  // Check if URL needs SAS
  const needsSas = backgroundAudioUrl && 
    !backgroundAudioUrl.includes('?') && 
    backgroundAudioUrl.includes('.blob.core.windows.net')

  // Check if inline audio URL needs SAS
  const needsInlineAudioSas = inlineAudioUrl && 
    !inlineAudioUrl.includes('?') && 
    inlineAudioUrl.includes('.blob.core.windows.net')

  // Parse blob URL to generate CLI command
  const parseBlobUrl = useCallback((url: string) => {
    try {
      const urlObj = new URL(url)
      const host = urlObj.hostname // e.g., "videotranslationpipeline.blob.core.windows.net"
      const accountName = host.split('.')[0]
      const pathParts = urlObj.pathname.split('/').filter(Boolean) // e.g., ["users", "poleli", "bgm", "button-2.wav"]
      const containerName = pathParts[0]
      const blobName = pathParts.slice(1).join('/')
      return { accountName, containerName, blobName }
    } catch {
      return null
    }
  }, [])

  // Generate CLI command for SAS
  const generateSasCommand = useCallback((url: string) => {
    const parsed = parseBlobUrl(url)
    if (!parsed) return null
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Tomorrow
    return `az storage blob generate-sas --account-name ${parsed.accountName} --container-name ${parsed.containerName} --name "${parsed.blobName}" --permissions r --expiry ${expiry} --auth-mode login --as-user -o tsv`
  }, [parseBlobUrl])

  // Memoized CLI commands
  const bgmSasCommand = useMemo(() => needsSas ? generateSasCommand(backgroundAudioUrl) : null, [needsSas, backgroundAudioUrl, generateSasCommand])
  const inlineSasCommand = useMemo(() => needsInlineAudioSas ? generateSasCommand(inlineAudioUrl) : null, [needsInlineAudioSas, inlineAudioUrl, generateSasCommand])

  // Copy handlers
  const handleCopyBgmCommand = useCallback(() => {
    if (bgmSasCommand) {
      navigator.clipboard.writeText(bgmSasCommand)
      setCopiedBgmCommand(true)
      setTimeout(() => setCopiedBgmCommand(false), 2000)
    }
  }, [bgmSasCommand])

  const handleCopyInlineCommand = useCallback(() => {
    if (inlineSasCommand) {
      navigator.clipboard.writeText(inlineSasCommand)
      setCopiedInlineCommand(true)
      setTimeout(() => setCopiedInlineCommand(false), 2000)
    }
  }, [inlineSasCommand])

  // Copy BGM URL
  const handleCopyBgmUrl = useCallback(() => {
    navigator.clipboard.writeText(backgroundAudioUrl)
    setCopiedBgmUrl(true)
    setTimeout(() => setCopiedBgmUrl(false), 2000)
  }, [backgroundAudioUrl])

  // Copy Inline Audio URL
  const handleCopyInlineUrl = useCallback(() => {
    navigator.clipboard.writeText(inlineAudioUrl)
    setCopiedInlineUrl(true)
    setTimeout(() => setCopiedInlineUrl(false), 2000)
  }, [inlineAudioUrl])

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">⚙️ Configuration</h2>

      {/* Saved custom endpoint URLs (user history), shared by all endpoint inputs */}
      <datalist id="endpoint-history">
        {endpointHistory.map(url => (
          <option key={url} value={url} />
        ))}
      </datalist>

      {/* Row 1: Endpoint */}
      <div className="mb-4">
        <div>
            {/* Toggle for dual endpoints */}
            <div className="flex items-center gap-2 mb-2">
              <label className="block font-semibold">Custom Endpoint:</label>
              <label className="flex items-center gap-1 text-sm cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={useDualEndpoints}
                  onChange={e => setUseDualEndpoints(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-blue-600">Use different URLs for Base/Target</span>
              </label>
            </div>
            
            {!useDualEndpoints ? (
              // Single endpoint mode
              <>
                <div className="flex gap-2">
                  <select
                    value={ALL_PRESET_ENDPOINTS.some(p => p.value === customEndpoint) ? customEndpoint : ''}
                    onChange={e => { if (e.target.value) { setCustomEndpoint(e.target.value); onCustomEndpointCommit?.(e.target.value) } }}
                    className="p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <EndpointPresetOptions />
                  </select>
                  <input
                    type="text"
                    value={customEndpoint}
                    onChange={e => setCustomEndpoint(e.target.value)}
                    onBlur={e => { commitEndpointHistory(e.target.value); onCustomEndpointCommit?.(e.target.value) }}
                    list="endpoint-history"
                    placeholder="ws://localhost:12345/cognitiveservices/websocket/v1"
                    className="flex-1 p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <small className="text-gray-500 text-sm">Select a local preset or Azure region, or enter a custom URL</small>
              </>
            ) : (
              // Dual endpoint mode
              <div className="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🏠 Base/Master FE Endpoint:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={ALL_PRESET_ENDPOINTS.some(p => p.value === baseEndpoint) ? baseEndpoint : ''}
                      onChange={e => e.target.value && setBaseEndpoint(e.target.value)}
                      className="p-2 border border-gray-300 rounded-md focus:border-gray-500 focus:ring-1 focus:ring-gray-500 text-sm bg-white"
                    >
                      <EndpointPresetOptions />
                    </select>
                    <input
                      type="text"
                      value={baseEndpoint}
                      onChange={e => setBaseEndpoint(e.target.value)}
                      onBlur={e => commitEndpointHistory(e.target.value)}
                      list="endpoint-history"
                      placeholder="ws://localhost:12345/cognitiveservices/websocket/v1"
                      className="flex-1 p-2 border border-gray-300 rounded-md focus:border-gray-500 focus:ring-1 focus:ring-gray-500 text-sm"
                    />
                  </div>
                  <small className="text-gray-500 text-xs">Baseline endpoint (no provenance header, server default)</small>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    🎯 Target FE Endpoint:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={ALL_PRESET_ENDPOINTS.some(p => p.value === targetEndpoint) ? targetEndpoint : ''}
                      onChange={e => e.target.value && setTargetEndpoint(e.target.value)}
                      className="p-2 border border-blue-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                    >
                      <EndpointPresetOptions />
                    </select>
                    <input
                      type="text"
                      value={targetEndpoint}
                      onChange={e => setTargetEndpoint(e.target.value)}
                      onBlur={e => commitEndpointHistory(e.target.value)}
                      list="endpoint-history"
                      placeholder="ws://localhost:12346/cognitiveservices/websocket/v1"
                      className="flex-1 p-2 border border-blue-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <label className="flex items-center gap-1 text-sm">
                      <span className="text-gray-600">Provenance:</span>
                      <select
                        value={targetProvenanceEnabled === null ? 'default' : targetProvenanceEnabled ? 'true' : 'false'}
                        onChange={e => {
                          const v = e.target.value
                          setTargetProvenanceEnabled(v === 'default' ? null : v === 'true')
                        }}
                        className="p-1 border border-blue-300 rounded text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="default">🔘 Default (server)</option>
                        <option value="true">🔒 ON</option>
                        <option value="false">🔓 OFF</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={targetFlightEnabled}
                        onChange={e => setTargetFlightEnabled(e.target.checked)}
                        className="w-3 h-3 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className={targetFlightEnabled ? 'text-purple-600' : 'text-gray-500'}>
                        {targetFlightEnabled ? '✈️ Flight ON' : '✈️ Flight OFF'}
                      </span>
                    </label>
                  </div>
                </div>
                <small className="text-gray-500 text-xs">
                  Compare performance between Base (master) and Target endpoints.
                </small>
              </div>
            )}
        </div>
      </div>

      {/* Row 2: Subscription Key */}
      <div className="mb-4">
        <label className="block font-semibold mb-1">Subscription Key:</label>
        <div className="relative">
          <input
            type={showSubKey ? 'text' : 'password'}
            value={subscriptionKey}
            onChange={e => setSubscriptionKey(e.target.value)}
            placeholder="Enter your Azure Speech subscription key"
            className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowSubKey(v => !v)}
            aria-label={showSubKey ? 'Hide subscription key' : 'Show subscription key'}
            title={showSubKey ? 'Hide subscription key' : 'Show subscription key'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
          >
            {showSubKey ? (
              // eye-off icon
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.584 10.587a2 2 0 002.828 2.83" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.363 5.365A9.466 9.466 0 0112 5c4.638 0 8.573 3.007 9.963 7.178a1.012 1.012 0 010 .639 10.04 10.04 0 01-2.79 4.142M6.228 6.228A10.045 10.045 0 002.037 11.32a1.012 1.012 0 000 .639C3.423 16.49 7.36 19.5 12 19.5c1.51 0 2.948-.32 4.25-.897" />
              </svg>
            ) : (
              // eye icon
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
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
              
              {/* Max detect count */}
              <div>
                <label className="block font-semibold mb-1 text-sm text-purple-700">Max Detect Count:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={detectMaxCount}
                    onChange={e => setDetectMaxCount(parseInt(e.target.value) || 0)}
                    className="w-24 p-2 border border-gray-300 rounded-md focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-600">(0 = all)</span>
                </div>
                <small className="text-gray-500 text-xs">Limit number of audio files to verify. Default: 3 (detect is slow)</small>
              </div>
            </div>
          )}
          
          <p className="text-sm text-purple-600 mt-2 ml-6">
            When enabled, provenance-enabled audio will be verified against the detect API after synthesis completes.
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

        {/* Output Format */}
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

        {/* Iterations */}
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

        {/* Warmup */}
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

      {/* Keep audio for download */}
      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={keepAudio}
            onChange={e => setKeepAudio(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm">保留合成音频以供下载（Keep audio for download）</span>
        </label>
        <small className="block text-gray-500 text-sm mt-1">
          默认关闭以节省内存。测试次数较多时建议保持关闭；开启后可在结果区下载音频。（水印校验需要音频时会临时保留并在完成后释放）
        </small>
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
            {backgroundAudioUrl && (
              <button
                onClick={handleCopyBgmUrl}
                className="px-3 py-2 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 whitespace-nowrap"
              >
                {copiedBgmUrl ? '✅ Copied!' : '📋 Copy URL'}
              </button>
            )}
          </div>
          {needsSas && (
            <>
              <div className="mt-2">
                <label className="block text-sm text-gray-600 mb-1">
                  SAS Token <span className="text-gray-400">(paste here, will be auto-appended)</span>:
                </label>
                <input
                  type="text"
                  value={bgmSasToken}
                  onChange={e => setBgmSasToken(e.target.value)}
                  placeholder="se=2026-06-12&sp=r&sig=..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                />
              </div>
              {bgmSasCommand && !bgmSasToken && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-blue-700 text-sm mb-2">
                    🔑 Run this command to generate SAS token:
                  </div>
                  <div className="flex gap-2">
                    <code className="flex-1 p-2 bg-gray-800 text-green-400 text-xs rounded font-mono overflow-x-auto whitespace-nowrap">
                      {bgmSasCommand}
                    </code>
                    <button
                      onClick={handleCopyBgmCommand}
                      className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 whitespace-nowrap"
                    >
                      {copiedBgmCommand ? '✅ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <small className="text-gray-500 text-xs">
            Only 16kHz/24kHz sample rates support BGM. Select from dropdown or enter a URL with SAS token.
          </small>
        </div>

        {/* Inline Audio URL (audio tag - plays sequentially) */}
        <div className="mb-2">
          <label className="block font-semibold mb-1 text-sm">
            Inline Audio URL <span className="text-gray-400 font-normal">(optional, &lt;audio&gt; tag)</span>:
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              list="inline-audio-url-options"
              value={inlineAudioUrl}
              onChange={e => setInlineAudioUrl(e.target.value)}
              placeholder="Select from list or enter URL"
              className="flex-1 p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
            <datalist id="inline-audio-url-options">
              <option value="https://videotranslationpipeline.blob.core.windows.net/users/poleli/bgm/audio-tag-sample.wav" label="Quiet Audio Tag Sample" />
            </datalist>
            {inlineAudioUrl && (
              <button
                onClick={handleCopyInlineUrl}
                className="px-3 py-2 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 whitespace-nowrap"
              >
                {copiedInlineUrl ? '✅ Copied!' : '📋 Copy URL'}
              </button>
            )}
          </div>
          {needsInlineAudioSas && (
            <>
              <div className="mt-2">
                <label className="block text-sm text-gray-600 mb-1">
                  SAS Token <span className="text-gray-400">(paste here, will be auto-appended)</span>:
                </label>
                <input
                  type="text"
                  value={inlineAudioSasToken}
                  onChange={e => setInlineAudioSasToken(e.target.value)}
                  placeholder="se=2026-06-12&sp=r&sig=..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                />
              </div>
              {inlineSasCommand && !inlineAudioSasToken && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-blue-700 text-sm mb-2">
                    🔑 Run this command to generate SAS token:
                  </div>
                  <div className="flex gap-2">
                    <code className="flex-1 p-2 bg-gray-800 text-green-400 text-xs rounded font-mono overflow-x-auto whitespace-nowrap">
                      {inlineSasCommand}
                    </code>
                    <button
                      onClick={handleCopyInlineCommand}
                      className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 whitespace-nowrap"
                    >
                      {copiedInlineCommand ? '✅ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <small className="text-gray-500 text-xs">
            Plays sequentially before speech (not in background). Supports .mp3, .wav, .opus, .ogg, .flac, .wma.
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
                  value="compare"
                  checked={testMode === 'compare'}
                  onChange={() => setTestMode('compare')}
                  className="w-4 h-4 text-blue-600"
                />
                <span>🔄 Compare Base vs Target</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="testMode"
                  value="base"
                  checked={testMode === 'base'}
                  onChange={() => setTestMode('base')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">🏠 Base Only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="testMode"
                  value="target"
                  checked={testMode === 'target'}
                  onChange={() => setTestMode('target')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-blue-700 font-medium">🎯 Target Only</span>
              </label>
            </div>
            {/* Test Order - only shown when testMode is 'compare' */}
            {testMode === 'compare' && (
              <div className="flex items-center gap-4 mt-2 ml-4 text-sm">
                <span className="text-gray-600">执行顺序:</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="testOrder"
                    value="baseFirst"
                    checked={testOrder === 'baseFirst'}
                    onChange={() => setTestOrder('baseFirst')}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="text-gray-700">Base</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-blue-700">Target</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="testOrder"
                    value="targetFirst"
                    checked={testOrder === 'targetFirst'}
                    onChange={() => setTestOrder('targetFirst')}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="text-blue-700">Target</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-700">Base</span>
                </label>
              </div>
            )}
          </div>

          {/* Row 4.7: Synthesis protocol */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center gap-2">
              <span className="font-medium whitespace-nowrap">Protocol:</span>
              <select
                value={protocol}
                onChange={e => handleProtocolChange(e.target.value as Protocol)}
                className="flex-1 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(PROTOCOL_LABELS) as Protocol[]).map(p => (
                  <option key={p} value={p}>{PROTOCOL_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Default endpoint path: <code className="bg-gray-200 px-1 rounded">{PROTOCOL_DEFAULT_PATHS[protocol]}</code>.
              Switching protocol rewrites the endpoint path (host:port preserved); you can still type a custom endpoint.
            </p>
          </div>

      {/* API Delay */}
      <div className="mb-4 flex items-center gap-3">
        <label className="font-semibold whitespace-nowrap">API 调用间隔:</label>
        <input
          type="number"
          min={0}
          max={10000}
          step={50}
          value={apiDelay}
          onChange={e => setApiDelay(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-600 text-sm">ms (0 = 无延迟)</span>
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
