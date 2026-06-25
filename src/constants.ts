export const REGIONS = [
  { value: 'australiaeast', label: 'Australia East' },
  { value: 'brazilsouth', label: 'Brazil South' },
  { value: 'canadacentral', label: 'Canada Central' },
  { value: 'canadaeast', label: 'Canada East' },
  { value: 'centralindia', label: 'Central India' },
  { value: 'centralus', label: 'Central US' },
  { value: 'eastasia', label: 'East Asia' },
  { value: 'eastus', label: 'East US' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'francecentral', label: 'France Central' },
  { value: 'germanywestcentral', label: 'Germany West Central' },
  { value: 'italynorth', label: 'Italy North' },
  { value: 'japaneast', label: 'Japan East' },
  { value: 'japanwest', label: 'Japan West' },
  { value: 'jioindiacentral', label: 'Jio India Central' },
  { value: 'jioindiawest', label: 'Jio India West' },
  { value: 'koreacentral', label: 'Korea Central' },
  { value: 'northcentralus', label: 'North Central US' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'norwayeast', label: 'Norway East' },
  { value: 'qatarcentral', label: 'Qatar Central' },
  { value: 'southafricanorth', label: 'South Africa North' },
  { value: 'southcentralus', label: 'South Central US' },
  { value: 'southeastasia', label: 'Southeast Asia' },
  { value: 'swedencentral', label: 'Sweden Central' },
  { value: 'switzerlandnorth', label: 'Switzerland North' },
  { value: 'switzerlandwest', label: 'Switzerland West' },
  { value: 'uaenorth', label: 'UAE North' },
  { value: 'uksouth', label: 'UK South' },
  { value: 'ukwest', label: 'UK West' },
  { value: 'westcentralus', label: 'West Central US' },
  { value: 'westeurope', label: 'West Europe' },
  { value: 'westus', label: 'West US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'westus3', label: 'West US 3' },
]

// TTS WebSocket v1 path used for both local and regional endpoints
export const TTS_WS_PATH = '/cognitiveservices/websocket/v1'

/**
 * Build the public Azure TTS WebSocket endpoint for a region.
 * e.g. 'eastus' -> 'wss://eastus.tts.speech.microsoft.com/cognitiveservices/websocket/v1'
 */
export function buildRegionWsEndpoint(region: string): string {
  return `wss://${region}.tts.speech.microsoft.com${TTS_WS_PATH}`
}

// Predefined local endpoint URLs for quick selection
export const PRESET_ENDPOINTS = [
  { value: 'ws://localhost:12345/cognitiveservices/websocket/v1', label: 'Local :12345 (default)' },
  { value: 'ws://localhost:12346/cognitiveservices/websocket/v1', label: 'Local :12346' },
]

// Region WebSocket endpoint presets for Base/Target selection.
// Selecting one fills the endpoint field with wss://{region}.tts.speech.microsoft.com/...
export const REGION_PRESET_ENDPOINTS = REGIONS.map(r => ({
  value: buildRegionWsEndpoint(r.value),
  label: `${r.label} (${r.value})`,
}))

// Combined preset list (local + regions) used to detect whether the current
// endpoint value matches a known preset.
export const ALL_PRESET_ENDPOINTS = [...PRESET_ENDPOINTS, ...REGION_PRESET_ENDPOINTS]

export const VOICES = [
  'en-US-AvaNeural',
  'en-US-AvaMultilingualNeural',
  'en-US-AndrewNeural',
  'en-US-AndrewMultilingualNeural',
  'en-US-JennyNeural',
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunxiNeural',
]

// Output formats for performance testing (subset)
export const OUTPUT_FORMATS = [
  { value: 'audio-16khz-32kbitrate-mono-mp3', label: 'MP3 16kHz 32kbps' },
  { value: 'audio-24khz-160kbitrate-mono-mp3', label: 'MP3 24kHz 160kbps' },
  { value: 'audio-24khz-48kbitrate-mono-mp3', label: 'MP3 24kHz 48kbps' },
  { value: 'audio-24khz-96kbitrate-mono-mp3', label: 'MP3 24kHz 96kbps' },
  { value: 'audio-48khz-192kbitrate-mono-mp3', label: 'MP3 48kHz 192kbps' },
  { value: 'audio-48khz-96kbitrate-mono-mp3', label: 'MP3 48kHz 96kbps' },
  { value: 'raw-16khz-16bit-mono-pcm', label: 'RAW 16kHz 16bit PCM' },
  { value: 'raw-24khz-16bit-mono-pcm', label: 'RAW 24kHz 16bit PCM' },
  { value: 'raw-8khz-16bit-mono-pcm', label: 'RAW 8kHz 16bit PCM' },
  { value: 'raw-8khz-8bit-mono-mulaw', label: 'RAW 8kHz 8bit μ-law' },
  { value: 'riff-16khz-16bit-mono-pcm', label: 'RIFF 16kHz 16bit PCM' },
  { value: 'riff-24khz-16bit-mono-pcm', label: 'RIFF 24kHz 16bit PCM' },
  { value: 'riff-48khz-16bit-mono-pcm', label: 'RIFF 48kHz 16bit PCM' },
  { value: 'webm-24khz-16bit-mono-opus', label: 'WebM 24kHz Opus' },
]
