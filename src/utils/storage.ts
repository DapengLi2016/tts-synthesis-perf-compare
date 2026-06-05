const STORAGE_KEY = 'tts-perf-compare-config'

export type TestMode = 'default' | 'both' | 'provOff' | 'provOn'

export interface ConfigData {
  endpointType?: 'region' | 'custom'
  region?: string
  customEndpoint?: string
  subscriptionKey?: string
  voiceName?: string
  outputFormat?: string
  ssmlCount?: number
  iterations?: number
  warmupRuns?: number
  enableCache?: boolean
  detectUrl?: string
  testMode?: TestMode
  useHttpApi?: boolean  // Use HTTP REST API instead of WebSocket SDK (for provenance header)
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
