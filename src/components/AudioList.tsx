import { useState, useCallback, useRef, useEffect } from 'react'
import JSZip from 'jszip'
import { TestResult } from '../utils/synthesizer'
import { SsmlData } from '../utils/ssmlGenerator'
import { detectWatermark, DetectResult, getCurrentUser, isSignedIn, setManualToken, clearManualToken } from '../utils/detect'

interface AudioListProps {
  results: TestResult[]
  ssmls: SsmlData[]
  detectUrl: string
  outputFormat: string
  autoDetectResults?: Record<string, DetectResult>
}

interface AudioItemState {
  isPlaying: boolean
  isDetecting: boolean
  detectResult?: DetectResult
}

export function AudioList({ results, ssmls, detectUrl, outputFormat, autoDetectResults }: AudioListProps) {
  const [expandedOff, setExpandedOff] = useState(false)
  const [expandedOn, setExpandedOn] = useState(false)
  const [audioStates, setAudioStates] = useState<Record<string, AudioItemState>>({})
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [copiedCommand, setCopiedCommand] = useState(false)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const audioUrlsRef = useRef<Record<string, string>>({})  // Cache blob URLs

  // Initialize audioStates from autoDetectResults when available
  useEffect(() => {
    if (autoDetectResults && Object.keys(autoDetectResults).length > 0) {
      setAudioStates(prev => {
        const newStates = { ...prev }
        for (const [key, detectResult] of Object.entries(autoDetectResults)) {
          newStates[key] = {
            ...newStates[key],
            isPlaying: false,
            isDetecting: false,
            detectResult,
          }
        }
        return newStates
      })
    }
  }, [autoDetectResults])

  // Check user sign-in status
  useEffect(() => {
    const checkUser = async () => {
      if (await isSignedIn()) {
        const user = await getCurrentUser()
        setCurrentUser(user)
      }
    }
    checkUser()
  }, [])

  // Handle set token
  const handleSetToken = useCallback(async () => {
    if (!tokenInput.trim()) return
    setManualToken(tokenInput.trim())
    setTokenInput('')
    setShowTokenInput(false)
    const user = await getCurrentUser()
    setCurrentUser(user)
  }, [tokenInput])

  // Copy command to clipboard
  const cliCommand = 'az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv'
  const handleCopyCommand = useCallback(() => {
    navigator.clipboard.writeText(cliCommand)
    setCopiedCommand(true)
    setTimeout(() => setCopiedCommand(false), 2000)
  }, [])

  // Handle logout (clear token)
  const handleLogout = useCallback(() => {
    clearManualToken()
    setCurrentUser(null)
  }, [])

  // Filter successful results with audio data
  const successfulResults = results.filter(r => r.success && r.audioData)
  const provOffResults = successfulResults.filter(r => !r.provenanceEnabled)
  const provOnResults = successfulResults.filter(r => r.provenanceEnabled)

  const getMimeType = useCallback(() => {
    if (outputFormat.includes('mp3')) return 'audio/mpeg'
    return 'audio/wav'
  }, [outputFormat])

  // Create and cache audio URL
  const getAudioUrl = useCallback((result: TestResult): string | null => {
    if (!result.audioData) return null
    const key = `${result.ssmlIndex}-${result.iteration}-${result.provenanceEnabled}`
    if (!audioUrlsRef.current[key]) {
      const blob = new Blob([result.audioData], { type: getMimeType() })
      audioUrlsRef.current[key] = URL.createObjectURL(blob)
    }
    return audioUrlsRef.current[key]
  }, [getMimeType])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(audioUrlsRef.current).forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  const getItemKey = (result: TestResult) => 
    `${result.ssmlIndex}-${result.iteration}-${result.provenanceEnabled}`

  const handlePlay = useCallback((result: TestResult) => {
    const key = getItemKey(result)
    const audioElement = audioRefs.current[key]
    
    if (audioElement) {
      if (audioStates[key]?.isPlaying) {
        audioElement.pause()
        audioElement.currentTime = 0
        setAudioStates(prev => ({ ...prev, [key]: { ...prev[key], isPlaying: false } }))
      } else {
        // Stop all other audio
        Object.keys(audioRefs.current).forEach(k => {
          if (k !== key && audioRefs.current[k]) {
            audioRefs.current[k]!.pause()
            audioRefs.current[k]!.currentTime = 0
          }
        })
        setAudioStates(prev => {
          const newStates: Record<string, AudioItemState> = {}
          Object.keys(prev).forEach(k => {
            newStates[k] = { ...prev[k], isPlaying: false }
          })
          newStates[key] = { ...prev[key], isPlaying: true }
          return newStates
        })
        // Handle play with promise to catch errors
        audioElement.play().catch(err => {
          console.error('Audio play error:', err)
          setAudioStates(prev => ({ ...prev, [key]: { ...prev[key], isPlaying: false } }))
        })
      }
    }
  }, [audioStates])

  const handleDetect = useCallback(async (result: TestResult) => {
    if (!detectUrl || !result.audioData) return
    
    const key = getItemKey(result)
    setAudioStates(prev => ({ ...prev, [key]: { ...prev[key], isDetecting: true } }))
    setLoginError(null)
    
    try {
      const detectResult = await detectWatermark(detectUrl, result.audioData, getMimeType())
      setAudioStates(prev => ({ 
        ...prev, 
        [key]: { ...prev[key], isDetecting: false, detectResult } 
      }))
      
      // Update user info after authentication
      if (await isSignedIn()) {
        const user = await getCurrentUser()
        setCurrentUser(user)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error'
      // If it's a popup blocked error, show as login error
      if (errorMessage.includes('Popup') || errorMessage.includes('popup')) {
        setLoginError(errorMessage)
      }
      setAudioStates(prev => ({ 
        ...prev, 
        [key]: { 
          ...prev[key], 
          isDetecting: false, 
          detectResult: { status: 'Error', error: errorMessage } 
        } 
      }))
    }
  }, [detectUrl, getMimeType])

  const handleAudioEnded = useCallback((key: string) => {
    setAudioStates(prev => ({ ...prev, [key]: { ...prev[key], isPlaying: false } }))
  }, [])

  // Get file extension based on output format
  const getFileExtension = useCallback(() => {
    if (outputFormat.includes('mp3')) return 'mp3'
    return 'wav'
  }, [outputFormat])

  // Download all SSMLs and audio files as a ZIP
  const handleDownloadAll = useCallback(async () => {
    if (successfulResults.length === 0) return
    
    setIsDownloading(true)
    try {
      const zip = new JSZip()
      const ext = getFileExtension()
      
      // Create folders
      const ssmlFolder = zip.folder('ssml')
      const audioOffFolder = zip.folder('audio-without-provenance')
      const audioOnFolder = zip.folder('audio-with-provenance')
      
      // Add SSMLs
      ssmls.forEach((ssmlData) => {
        ssmlFolder?.file(`ssml-${ssmlData.index}.xml`, ssmlData.ssml)
      })
      
      // Add audio files
      successfulResults.forEach((result) => {
        if (result.audioData) {
          const filename = `ssml-${result.ssmlIndex}-iter-${result.iteration}.${ext}`
          const folder = result.provenanceEnabled ? audioOnFolder : audioOffFolder
          folder?.file(filename, result.audioData)
        }
      })
      
      // Add requests.json with all requestIds for log correlation
      const requestsData = {
        generatedAt: new Date().toISOString(),
        description: 'Request IDs (X-RequestId) for correlating with backend logs in Kusto/Application Insights',
        totalRequests: successfulResults.length,
        requests: successfulResults.map(result => ({
          ssmlIndex: result.ssmlIndex,
          iteration: result.iteration,
          provenanceEnabled: result.provenanceEnabled,
          requestId: result.requestId || null,
          timestamp: result.timestamp,
          firstByteLatencyMs: result.firstByteLatencyMs,
          lastByteLatencyMs: result.lastByteLatencyMs,
          totalBytes: result.totalBytes,
          success: result.success,
        }))
      }
      zip.file('requests.json', JSON.stringify(requestsData, null, 2))
      
      // Generate ZIP and download
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tts-synthesis-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
      alert('Download failed: ' + (error as Error).message)
    } finally {
      setIsDownloading(false)
    }
  }, [successfulResults, ssmls, getFileExtension])

  const renderAudioItem = (result: TestResult) => {
    const key = getItemKey(result)
    const state = audioStates[key] || {}
    const audioUrl = getAudioUrl(result)
    
    return (
      <div key={key} className="border border-gray-200 rounded-lg p-3 mb-2 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <span className="text-sm font-medium">
              SSML #{result.ssmlIndex} (Iter {result.iteration})
            </span>
            <div className="text-xs text-gray-500">
              {(result.totalBytes! / 1024).toFixed(1)} KB | 
              First: {result.firstByteLatencyMs?.toFixed(0)}ms | 
              Total: {result.lastByteLatencyMs?.toFixed(0)}ms
            </div>
            {result.requestId && (
              <div className="text-xs font-mono text-blue-600" title="X-RequestId for log correlation">
                RequestId: {result.requestId}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Audio player with native controls */}
            {audioUrl && (
              <>
                <audio
                  ref={el => audioRefs.current[key] = el}
                  src={audioUrl}
                  preload="auto"
                  controls
                  onEnded={() => handleAudioEnded(key)}
                  onError={(e) => console.error('Audio load error:', key, e)}
                  className="h-8"
                />
                {/* Download button */}
                <a
                  href={audioUrl}
                  download={`ssml-${result.ssmlIndex}-iter-${result.iteration}-prov-${result.provenanceEnabled}.${getFileExtension()}`}
                  className="px-3 py-1 text-sm rounded bg-gray-500 text-white hover:bg-gray-600"
                  title="Download audio file"
                >
                  💾
                </a>
              </>
            )}
            
            {/* Detect button */}
            {detectUrl && result.audioData && (
              <button
                onClick={() => handleDetect(result)}
                disabled={state.isDetecting}
                className={`px-3 py-1 text-sm rounded ${
                  state.isDetecting
                    ? 'bg-gray-400 text-white cursor-wait'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {state.isDetecting ? '🔄 Detecting...' : '🔍 Detect'}
              </button>
            )}
          </div>
        </div>
        
        {/* Detect result */}
        {state.detectResult && (
          <div className={`mt-2 p-2 rounded text-sm ${
            state.detectResult.status === 'SuccessByWatermarkExtraction'
              ? 'bg-green-100 text-green-800'
              : state.detectResult.status === 'Error'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            <div className="font-medium">Status: {state.detectResult.status}</div>
            {state.detectResult.publicUUID && (
              <div className="text-xs font-mono">UUID: {state.detectResult.publicUUID}</div>
            )}
            {state.detectResult.error && (
              <div className="text-xs">{state.detectResult.error}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (successfulResults.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between border-b-2 border-blue-600 pb-2 mb-4">
        <h2 className="text-xl font-semibold text-blue-600">
          🎵 Synthesized Audio ({successfulResults.length} files)
        </h2>
        <button
          onClick={handleDownloadAll}
          disabled={isDownloading}
          className={`px-4 py-2 text-sm font-medium rounded-lg ${
            isDownloading
              ? 'bg-gray-400 text-white cursor-wait'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {isDownloading ? '📦 Packaging...' : '📦 Download All (ZIP)'}
        </button>
      </div>
      
      {/* User info / Login */}
      {detectUrl && (
        <div className="mb-4 p-3 bg-blue-50 rounded">
          {currentUser ? (
            <div className="flex items-center justify-between">
              <span className="text-sm">
                👤 Signed in as: <span className="font-medium">{currentUser.name}</span> ({currentUser.email})
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm text-gray-600">
                  🔐 Sign in to use Detect feature
                </span>
                <button
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="px-4 py-1 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  🔑 Set Access Token
                </button>
              </div>
              
              {showTokenInput && (
                <div className="p-3 bg-white rounded border border-gray-200">
                  <div className="text-sm text-gray-600 mb-3">
                    Run this command in terminal to get an access token:
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <code className="flex-1 bg-gray-800 text-green-400 p-3 rounded font-mono text-sm select-all">
                      {cliCommand}
                    </code>
                    <button
                      onClick={handleCopyCommand}
                      className={`px-3 py-3 text-sm font-medium rounded ${
                        copiedCommand
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      title="Copy to clipboard"
                    >
                      {copiedCommand ? '✓' : '📋'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="Paste your access token here..."
                      className="flex-1 p-2 text-sm border border-gray-300 rounded font-mono"
                    />
                    <button
                      onClick={handleSetToken}
                      disabled={!tokenInput.trim()}
                      className="px-4 py-2 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400"
                    >
                      Set Token
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Login error */}
      {loginError && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          ❌ {loginError}
        </div>
      )}
      
      {/* Detect URL warning */}
      {!detectUrl && (
        <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
          ℹ️ Enter a Detect API URL in the configuration to enable watermark detection
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Without Provenance */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedOff(!expandedOff)}
            className="w-full p-3 bg-gray-100 hover:bg-gray-200 flex items-center justify-between font-medium"
          >
            <span>🔓 Without Provenance ({provOffResults.length})</span>
            <span>{expandedOff ? '▼' : '▶'}</span>
          </button>
          {expandedOff && (
            <div className="p-3 max-h-96 overflow-y-auto bg-gray-50">
              {provOffResults.length === 0 ? (
                <div className="text-gray-500 text-sm">No audio files</div>
              ) : (
                provOffResults.map(renderAudioItem)
              )}
            </div>
          )}
        </div>

        {/* With Provenance */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedOn(!expandedOn)}
            className="w-full p-3 bg-blue-100 hover:bg-blue-200 flex items-center justify-between font-medium"
          >
            <span>🔒 With Provenance ({provOnResults.length})</span>
            <span>{expandedOn ? '▼' : '▶'}</span>
          </button>
          {expandedOn && (
            <div className="p-3 max-h-96 overflow-y-auto bg-blue-50">
              {provOnResults.length === 0 ? (
                <div className="text-gray-500 text-sm">No audio files</div>
              ) : (
                provOnResults.map(renderAudioItem)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
