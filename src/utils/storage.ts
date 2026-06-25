const STORAGE_KEY = 'tts-perf-compare-config'

// Test modes: default (no header), compare (base vs target), base only, target only
export type TestMode = 'default' | 'compare' | 'base' | 'target'

export type TestOrder = 'baseFirst' | 'targetFirst'  // Execution order when testMode='compare'

export type DetectAuthType = 'apiKey' | 'token'

// Synthesis protocol: WebSocket SDK (v1), HTTP REST (/synthesize), or
// bidirectional text streaming (v2 /tts/cognitiveservices/websocket/v2).
export type Protocol = 'websocket' | 'http' | 'bidirectional'

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
  useHttpApi?: boolean  // Deprecated: use HTTP REST API instead of WebSocket SDK (superseded by `protocol`)
  protocol?: Protocol  // Synthesis protocol: 'websocket' | 'http' | 'bidirectional'
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

// --- Custom endpoint history (user-entered URLs not in the preset list) ---

const ENDPOINT_HISTORY_KEY = 'tts-perf-compare-endpoint-history'
const ENDPOINT_HISTORY_MAX = 20

// History is stored per-protocol so each protocol has its own list of recently
// used custom endpoints, e.g. { websocket: [...], http: [...], bidirectional: [...] }.
type EndpointHistoryMap = Partial<Record<Protocol, string[]>>

function loadEndpointHistoryMap(): EndpointHistoryMap {
  try {
    const saved = localStorage.getItem(ENDPOINT_HISTORY_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Migrate legacy flat-array format (pre per-protocol) into the websocket bucket.
      if (Array.isArray(parsed)) {
        const list = parsed.filter((u): u is string => typeof u === 'string')
        return { websocket: list }
      }
      if (parsed && typeof parsed === 'object') {
        return parsed as EndpointHistoryMap
      }
    }
  } catch (e) {
    console.warn('Failed to load endpoint history from localStorage:', e)
  }
  return {}
}

export function loadEndpointHistory(protocol: Protocol): string[] {
  const map = loadEndpointHistoryMap()
  const list = map[protocol]
  return Array.isArray(list) ? list.filter((u): u is string => typeof u === 'string') : []
}

// Adds a URL to the front of the given protocol's history (most recent first),
// de-duplicating and capping the list size. Returns the updated list.
export function addEndpointHistory(protocol: Protocol, url: string): string[] {
  const trimmed = url.trim()
  if (!trimmed) return loadEndpointHistory(protocol)
  try {
    const map = loadEndpointHistoryMap()
    const existing = (map[protocol] || []).filter(u => u !== trimmed)
    const updated = [trimmed, ...existing].slice(0, ENDPOINT_HISTORY_MAX)
    map[protocol] = updated
    localStorage.setItem(ENDPOINT_HISTORY_KEY, JSON.stringify(map))
    return updated
  } catch (e) {
    console.warn('Failed to save endpoint history to localStorage:', e)
    return loadEndpointHistory(protocol)
  }
}

// --- Per-endpoint subscription keys ---
// The subscription key follows the selected region / custom endpoint: switching
// the endpoint restores the key that was last used with it. Keys are stored in a
// separate map keyed by the region name or the custom endpoint URL.

const SUBKEY_STORE_KEY = 'tts-perf-compare-subkeys'

type SubKeyMap = Record<string, string>

function loadSubKeyMap(): SubKeyMap {
  try {
    const saved = localStorage.getItem(SUBKEY_STORE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as SubKeyMap
      }
    }
  } catch (e) {
    console.warn('Failed to load subscription keys from localStorage:', e)
  }
  return {}
}

// Returns the saved subscription key for the given endpoint (region or URL), or ''.
export function loadSubKey(endpointKey: string): string {
  const k = endpointKey?.trim()
  if (!k) return ''
  const map = loadSubKeyMap()
  return typeof map[k] === 'string' ? map[k] : ''
}

// Saves (or clears, when empty) the subscription key for the given endpoint.
export function saveSubKey(endpointKey: string, key: string): void {
  const k = endpointKey?.trim()
  if (!k) return
  try {
    const map = loadSubKeyMap()
    const trimmed = key.trim()
    if (trimmed) {
      map[k] = trimmed
    } else {
      delete map[k]
    }
    localStorage.setItem(SUBKEY_STORE_KEY, JSON.stringify(map))
  } catch (e) {
    console.warn('Failed to save subscription key to localStorage:', e)
  }
}

export function clearEndpointHistory(): void {
  try {
    localStorage.removeItem(ENDPOINT_HISTORY_KEY)
  } catch (e) {
    console.warn('Failed to clear endpoint history from localStorage:', e)
  }
}
