const STORAGE_KEY = 'tts-perf-compare-config'

export type TestMode = 'default' | 'both' | 'provOff' | 'provOn'

export type DetectAuthType = 'apiKey' | 'token'

export interface ConfigData {
  endpointType?: 'region' | 'custom'
  region?: string
  customEndpoint?: string
  subscriptionKey?: string
  accessToken?: string  // Optional Azure AD access token for user identity operations (detect API, storage SAS)
  voiceName?: string
  outputFormat?: string
  ssmlCount?: number
  iterations?: number
  warmupRuns?: number
  enableCache?: boolean
  detectUrl?: string
  detectAuthType?: DetectAuthType  // 'apiKey' or 'token'
  detectToken?: string  // API key or Access Token for detect API
  verifyWatermark?: boolean  // Auto-verify watermark after synthesis completes
  testMode?: TestMode
  useHttpApi?: boolean  // Use HTTP REST API instead of WebSocket SDK (for provenance header)
  // SSML options
  useMultiVoice?: boolean  // true = 2 voice elements, false = 1 voice element
  backgroundAudioUrl?: string  // optional background audio URL (with SAS token)
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
