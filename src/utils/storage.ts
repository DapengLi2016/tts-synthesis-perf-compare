const STORAGE_KEY = 'tts-perf-compare-config'

// Test modes: default (no header), compare (base vs target), base only, target only
export type TestMode = 'default' | 'compare' | 'base' | 'target'

export type TestOrder = 'baseFirst' | 'targetFirst'  // Execution order when testMode='compare'

export type DetectAuthType = 'apiKey' | 'token'

export interface ConfigData {
  endpointType?: 'region' | 'custom'
  region?: string
  customEndpoint?: string
  baseEndpoint?: string  // Base/Master FE endpoint (when useDualEndpoints is true)
  targetEndpoint?: string  // Target FE endpoint (when useDualEndpoints is true)
  targetProvenanceEnabled?: boolean | null  // Enable provenance on target FE: true=ON, false=OFF, null=server default
  targetFlightEnabled?: boolean  // Enable ttsfrontend-provenance flight via setfeature query param
  useDualEndpoints?: boolean  // Use different endpoints for Base vs Target comparison
  subscriptionKey?: string
  accessToken?: string  // Optional Azure AD access token for cognitive services (detect API with token auth)
  voiceName?: string
  outputFormat?: string
  ssmlCount?: number
  iterations?: number
  warmupRuns?: number
  keepAudio?: boolean  // Keep synthesized audio in memory for later download (default false to save memory)
  enableCache?: boolean
  detectUrl?: string
  detectAuthType?: DetectAuthType  // 'apiKey' or 'token'
  detectToken?: string  // API key or Access Token for detect API
  verifyWatermark?: boolean  // Auto-verify watermark after synthesis completes
  detectMaxCount?: number  // Max number of audio files to verify (0 = all)
  testMode?: TestMode
  testOrder?: TestOrder  // Execution order when testMode='compare': 'baseFirst' or 'targetFirst'
  apiDelay?: number  // Delay in ms between API calls
  useHttpApi?: boolean  // Use HTTP REST API instead of WebSocket SDK (for provenance header)
  // SSML options
  useMultiVoice?: boolean  // true = 2 voice elements, false = 1 voice element
  backgroundAudioUrl?: string  // optional background audio URL
  inlineAudioUrl?: string  // optional inline audio URL for <audio> tag (plays sequentially with speech)
  bgmSasToken?: string  // SAS token for background audio URL
  inlineAudioSasToken?: string  // SAS token for inline audio URL
}

export function loadConfig(): ConfigData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.warn('Failed to load config from localStorage:', e)
  }
  return {}
}

export function saveConfig(config: ConfigData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    console.warn('Failed to save config to localStorage:', e)
  }
}

export function clearConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.warn('Failed to clear config from localStorage:', e)
  }
}
