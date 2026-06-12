export const REGIONS = [
  { value: 'eastus', label: 'East US' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'westus', label: 'West US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'westus3', label: 'West US 3' },
  { value: 'centralus', label: 'Central US' },
  { value: 'northcentralus', label: 'North Central US' },
  { value: 'southcentralus', label: 'South Central US' },
  { value: 'canadacentral', label: 'Canada Central' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'westeurope', label: 'West Europe' },
  { value: 'uksouth', label: 'UK South' },
  { value: 'francecentral', label: 'France Central' },
  { value: 'germanywestcentral', label: 'Germany West Central' },
  { value: 'swedencentral', label: 'Sweden Central' },
  { value: 'southeastasia', label: 'Southeast Asia' },
  { value: 'eastasia', label: 'East Asia' },
  { value: 'australiaeast', label: 'Australia East' },
  { value: 'japaneast', label: 'Japan East' },
  { value: 'koreacentral', label: 'Korea Central' },
]

// Predefined endpoint URLs for quick selection
export const PRESET_ENDPOINTS = [
  { value: 'ws://localhost:12345/cognitiveservices/websocket/v1', label: 'Local :12345 (default)' },
  { value: 'ws://localhost:12346/cognitiveservices/websocket/v1', label: 'Local :12346' },
]

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
