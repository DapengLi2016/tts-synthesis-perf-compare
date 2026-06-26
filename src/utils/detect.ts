import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'

// MSAL configuration for Azure AD authentication
const msalConfig = {
  auth: {
    clientId: '04b07795-8ddb-461a-bbee-02f9e1bf7b46', // Azure CLI client ID (public)
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage' as const,
  },
}

let msalInstance: PublicClientApplication | null = null
let msalInitPromise: Promise<void> | null = null
let redirectHandlePromise: Promise<void> | null = null

// Manual token storage key
const MANUAL_TOKEN_KEY = 'tts-perf-manual-token'

// Scope for Cognitive Services
const cognitiveServicesScope = 'https://cognitiveservices.azure.com/.default'

// Initialize MSAL instance (singleton)
async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig)
  }
  if (!msalInitPromise) {
    msalInitPromise = msalInstance.initialize()
  }
  await msalInitPromise
  
  // Handle redirect response only once
  if (!redirectHandlePromise) {
    redirectHandlePromise = (async () => {
      try {
        const response = await msalInstance!.handleRedirectPromise()
        if (response) {
          console.log('MSAL: Logged in via redirect:', response.account?.username)
        }
      } catch (error: any) {
        if (error.errorCode !== 'no_token_request_cache_error') {
          console.error('MSAL redirect error:', error)
        }
      }
    })()
  }
  await redirectHandlePromise
  
  return msalInstance
}

export interface DetectResult {
  status: string
  publicUUID?: string
  error?: string
  raw?: any
}

/**
 * Set manual access token (for users who get token via Azure CLI)
 */
export function setManualToken(token: string): void {
  localStorage.setItem(MANUAL_TOKEN_KEY, token)
  console.log('Manual token set')
}

/**
 * Get manual access token
 */
export function getManualToken(): string | null {
  return localStorage.getItem(MANUAL_TOKEN_KEY)
}

/**
 * Clear manual access token
 */
export function clearManualToken(): void {
  localStorage.removeItem(MANUAL_TOKEN_KEY)
}

// Device code flow types
export interface DeviceCodeInfo {
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
  deviceCode: string
  message: string
}

// Device code polling state
let deviceCodePollingAbort: AbortController | null = null

/**
 * Start device code flow - returns info for user to complete login
 */
export async function startDeviceCodeFlow(): Promise<DeviceCodeInfo> {
  const clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46' // Azure CLI public client ID
  const scope = 'https://cognitiveservices.azure.com/.default offline_access'
  
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/devicecode', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope: scope,
    }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to start device code flow: ${errorText}`)
  }
  
  const data = await response.json()
  return {
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval || 5,
    deviceCode: data.device_code,
    message: data.message,
  }
}

/**
 * Poll for device code token completion
 * Returns the access token when user completes login
 */
export async function pollDeviceCodeToken(
  deviceCode: string,
  interval: number,
  onPoll?: () => void
): Promise<string> {
  const clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
  
  // Cancel any existing polling
  if (deviceCodePollingAbort) {
    deviceCodePollingAbort.abort()
  }
  deviceCodePollingAbort = new AbortController()
  
  const pollInterval = Math.max(interval, 5) * 1000 // At least 5 seconds
  
  while (true) {
    // Check if aborted
    if (deviceCodePollingAbort.signal.aborted) {
      throw new Error('Device code flow cancelled')
    }
    
    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
        }),
        signal: deviceCodePollingAbort.signal,
      })
      
      const data = await response.json()
      
      if (response.ok && data.access_token) {
        // Success! Store token and return
        setManualToken(data.access_token)
        deviceCodePollingAbort = null
        return data.access_token
      }
      
      // Check for pending or errors
      if (data.error === 'authorization_pending') {
        // User hasn't completed login yet, keep polling
        onPoll?.()
      } else if (data.error === 'slow_down') {
        // Need to slow down polling
        await new Promise(resolve => setTimeout(resolve, pollInterval + 5000))
        continue
      } else if (data.error === 'expired_token') {
        throw new Error('Device code expired. Please try again.')
      } else if (data.error === 'authorization_declined') {
        throw new Error('Authorization was declined.')
      } else if (data.error) {
        throw new Error(`Device code error: ${data.error_description || data.error}`)
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Device code flow cancelled')
      }
      throw error
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
}

/**
 * Cancel device code polling
 */
export function cancelDeviceCodeFlow(): void {
  if (deviceCodePollingAbort) {
    deviceCodePollingAbort.abort()
    deviceCodePollingAbort = null
  }
}

/**
 * Get an access token for Cognitive Services using MSAL or manual token
 */
async function getAccessToken(): Promise<string> {
  // Check for manual token first
  const manualToken = getManualToken()
  if (manualToken) {
    console.log('Using manual token')
    return manualToken
  }
  
  const msal = await getMsalInstance()
  
  const accounts = msal.getAllAccounts()
  console.log('MSAL accounts found:', accounts.length)
  
  if (accounts.length > 0) {
    // Try silent token acquisition first
    try {
      console.log('Trying silent token acquisition for:', accounts[0].username)
      const response = await msal.acquireTokenSilent({
        scopes: [cognitiveServicesScope],
        account: accounts[0],
      })
      console.log('Silent token acquired successfully')
      return response.accessToken
    } catch (error) {
      console.log('Silent token acquisition failed:', error)
      if (error instanceof InteractionRequiredAuthError) {
        // Need interactive login - use redirect
        console.log('Interaction required, redirecting to login...')
        await msal.acquireTokenRedirect({
          scopes: [cognitiveServicesScope],
        })
        // This line won't be reached as browser will redirect
        throw new Error('Redirecting to login...')
      }
      throw error
    }
  }
  
  // No accounts and no manual token - throw error with instructions
  throw new Error('Not logged in. Please click "Set Access Token" to authenticate.')
}

/**
 * Login via redirect (page will navigate to Microsoft login)
 */
export async function loginRedirect(): Promise<void> {
  const msal = await getMsalInstance()
  console.log('Starting redirect login...')
  await msal.loginRedirect({
    scopes: [cognitiveServicesScope],
  })
}

/**
 * Call the Provenance Detect API
 * @param detectUrl The Content Safety detect endpoint URL
 * @param audioData The audio data as ArrayBuffer
 * @param mimeType The MIME type of the audio (e.g., 'audio/wav', 'audio/mpeg')
 */
export async function detectWatermark(
  detectUrl: string,
  audioData: ArrayBuffer,
  mimeType: string = 'audio/wav'
): Promise<DetectResult> {
  try {
    // Get access token
    const accessToken = await getAccessToken()
    
    // Convert audio data to base64
    const base64Data = arrayBufferToBase64(audioData)
    
    // Build the detect request
    const requestBody = {
      mimeType: mimeType,
      data: base64Data,
    }
    
    // Call the detect API (remove trailing slash from URL if present)
    const baseUrl = detectUrl.replace(/\/+$/, '')
    console.log('Calling detect API:', baseUrl)
    const response = await fetch(`${baseUrl}/contentsafety/provenance:detect?api-version=2025-09-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return {
        status: 'Error',
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }
    
    const result = await response.json()
    return {
      status: result.status || 'Unknown',
      publicUUID: result.publicUUID,
      raw: result,
    }
  } catch (error: any) {
    return {
      status: 'Error',
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Check if user is signed in (via MSAL or manual token)
 */
export async function isSignedIn(): Promise<boolean> {
  if (getManualToken()) return true
  const msal = await getMsalInstance()
  return msal.getAllAccounts().length > 0
}

/**
 * Login via redirect (no popup needed)
 */
export async function login(): Promise<void> {
  await loginRedirect()
}

/**
 * Sign out (clears MSAL accounts and manual token)
 */
export async function signOut(): Promise<void> {
  clearManualToken()
  const msal = await getMsalInstance()
  const accounts = msal.getAllAccounts()
  if (accounts.length > 0) {
    // Use redirect logout to avoid popup issues
    await msal.logoutRedirect({ account: accounts[0] })
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<{ name: string; email: string } | null> {
  if (getManualToken()) {
    return { name: 'Manual Token', email: '(token set via CLI)' }
  }
  const msal = await getMsalInstance()
  const accounts = msal.getAllAccounts()
  if (accounts.length > 0) {
    return {
      name: accounts[0].name || 'Unknown',
      email: accounts[0].username || 'Unknown',
    }
  }
  return null
}

/**
 * Check if the output format is raw PCM (no WAV header)
 */
export function isRawFormat(outputFormat: string): boolean {
  return outputFormat.toLowerCase().startsWith('raw-')
}

/**
 * Extract audio parameters from output format string.
 * Examples: 'raw-24khz-16bit-mono-pcm' -> { sampleRate: 24000, bitsPerSample: 16, channels: 1 }
 */
export function parseAudioFormat(outputFormat: string): { sampleRate: number; bitsPerSample: number; channels: number } {
  const format = outputFormat.toLowerCase()
  
  // Extract sample rate (e.g., '24khz' -> 24000)
  const sampleRateMatch = format.match(/(\d+)khz/)
  const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1]) * 1000 : 24000
  
  // Extract bits per sample (e.g., '16bit' -> 16)
  const bitsMatch = format.match(/(\d+)bit/)
  const bitsPerSample = bitsMatch ? parseInt(bitsMatch[1]) : 16
  
  // Extract channels (mono = 1, stereo = 2)
  const channels = format.includes('stereo') ? 2 : 1
  
  return { sampleRate, bitsPerSample, channels }
}

/**
 * Add WAV header to raw PCM data.
 * This creates a valid WAV file from raw PCM audio data.
 */
export function addWavHeader(rawPcmData: ArrayBuffer, sampleRate: number, bitsPerSample: number = 16, channels: number = 1): ArrayBuffer {
  const dataSize = rawPcmData.byteLength
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  
  // WAV header is 44 bytes
  const headerSize = 44
  const wavBuffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(wavBuffer)
  
  // RIFF header
  writeString(view, 0, 'RIFF')                      // ChunkID
  view.setUint32(4, 36 + dataSize, true)            // ChunkSize (file size - 8)
  writeString(view, 8, 'WAVE')                      // Format
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ')                     // Subchunk1ID
  view.setUint32(16, 16, true)                      // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true)                       // AudioFormat (1 = PCM)
  view.setUint16(22, channels, true)                // NumChannels
  view.setUint32(24, sampleRate, true)              // SampleRate
  view.setUint32(28, byteRate, true)                // ByteRate
  view.setUint16(32, blockAlign, true)              // BlockAlign
  view.setUint16(34, bitsPerSample, true)           // BitsPerSample
  
  // data sub-chunk
  writeString(view, 36, 'data')                     // Subchunk2ID
  view.setUint32(40, dataSize, true)                // Subchunk2Size
  
  // Copy PCM data after header
  new Uint8Array(wavBuffer, headerSize).set(new Uint8Array(rawPcmData))
  
  return wavBuffer
}

/**
 * Helper to write ASCII string to DataView
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * Parse Retry-After header value
 * Can be either seconds (number) or HTTP-date
 */
function parseRetryAfter(retryAfter: string | null): number {
  if (!retryAfter) return 1000 // Default 1 second
  
  // Try parsing as seconds
  const seconds = parseInt(retryAfter, 10)
  if (!isNaN(seconds)) {
    return seconds * 1000
  }
  
  // Try parsing as HTTP-date
  const date = Date.parse(retryAfter)
  if (!isNaN(date)) {
    const delayMs = date - Date.now()
    return Math.max(delayMs, 0)
  }
  
  return 1000 // Default 1 second
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Parse retry after duration from error message like:
 * "Please retry after 7 seconds."
 * Returns milliseconds
 */
function parseRetryAfterFromMessage(message: string): number {
  const match = message.match(/retry after (\d+) seconds?/i)
  if (match) {
    return parseInt(match[1], 10) * 1000
  }
  return 1000 // Default 1 second
}

/**
 * Call the Provenance Detect API using API Key authentication
 * @param detectUrl The Content Safety detect endpoint URL
 * @param apiKey The Content Safety API key
 * @param audioData The audio data as ArrayBuffer
 * @param mimeType The MIME type of the audio (e.g., 'audio/wav', 'audio/mpeg')
 * @param maxRetries Maximum number of retries for 429 errors (default: 5)
 */
export async function detectWatermarkWithKey(
  detectUrl: string,
  apiKey: string,
  audioData: ArrayBuffer,
  mimeType: string = 'audio/wav',
  maxRetries: number = 5
): Promise<DetectResult> {
  // Convert audio data to base64
  const base64Data = arrayBufferToBase64(audioData)
  
  // Build the detect request
  const requestBody = {
    mimeType: mimeType,
    data: base64Data,
  }
  
  // Call the detect API (remove trailing slash from URL if present)
  const baseUrl = detectUrl.replace(/\/+$/, '')
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/contentsafety/provenance:detect?api-version=2025-09-15-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
      })
      
      // Handle 429 Too Many Requests with Retry-After header
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After')
        const delayMs = parseRetryAfter(retryAfter)
        console.log(`Rate limited (429), waiting ${delayMs}ms before retry ${attempt + 1}/${maxRetries}`)
        await sleep(delayMs)
        continue
      }
      
      // Parse response body
      const responseText = await response.text()
      let result: any
      try {
        result = JSON.parse(responseText)
      } catch {
        return {
          status: 'Error',
          error: `HTTP ${response.status}: ${responseText}`,
        }
      }
      
      // Handle 429 in response body (Content Safety API returns this format)
      // { "error": { "code": "429", "message": "... Please retry after 7 seconds. ..." } }
      if (result.error?.code === '429' && attempt < maxRetries) {
        const delayMs = parseRetryAfterFromMessage(result.error.message || '')
        console.log(`Rate limited (body 429), waiting ${delayMs}ms before retry ${attempt + 1}/${maxRetries}`)
        await sleep(delayMs)
        continue
      }
      
      if (!response.ok || result.error) {
        return {
          status: 'Error',
          error: result.error ? `${result.error.code}: ${result.error.message}` : `HTTP ${response.status}: ${responseText}`,
        }
      }
      
      return {
        status: result.status || 'Unknown',
        publicUUID: result.publicUUID,
        raw: result,
      }
    } catch (error: any) {
      if (attempt === maxRetries) {
        return {
          status: 'Error',
          error: error.message || 'Unknown error',
        }
      }
      // For network errors, wait a bit before retry
      await sleep(1000)
    }
  }
  
  return {
    status: 'Error',
    error: 'Max retries exceeded',
  }
}

/**
 * Call the Provenance Detect API using Bearer token authentication
 * @param detectUrl The Content Safety detect endpoint URL
 * @param token The Bearer access token (e.g., from az account get-access-token)
 * @param audioData The audio data as ArrayBuffer
 * @param mimeType The MIME type of the audio (e.g., 'audio/wav', 'audio/mpeg')
 * @param maxRetries Maximum number of retries for 429 errors (default: 5)
 */
export async function detectWatermarkWithToken(
  detectUrl: string,
  token: string,
  audioData: ArrayBuffer,
  mimeType: string = 'audio/wav',
  maxRetries: number = 5
): Promise<DetectResult> {
  // Convert audio data to base64
  const base64Data = arrayBufferToBase64(audioData)
  
  // Build the detect request
  const requestBody = {
    mimeType: mimeType,
    data: base64Data,
  }
  
  // Call the detect API (remove trailing slash from URL if present)
  const baseUrl = detectUrl.replace(/\/+$/, '')
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/contentsafety/provenance:detect?api-version=2025-09-15-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })
      
      // Handle 429 Too Many Requests with Retry-After header
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After')
        const delayMs = parseRetryAfter(retryAfter)
        console.log(`Rate limited (429), waiting ${delayMs}ms before retry ${attempt + 1}/${maxRetries}`)
        await sleep(delayMs)
        continue
      }
      
      // Parse response body
      const responseText = await response.text()
      let result: any
      try {
        result = JSON.parse(responseText)
      } catch {
        return {
          status: 'Error',
          error: `HTTP ${response.status}: ${responseText}`,
        }
      }
      
      // Handle 429 in response body (Content Safety API returns this format)
      // { "error": { "code": "429", "message": "... Please retry after 7 seconds. ..." } }
      if (result.error?.code === '429' && attempt < maxRetries) {
        const delayMs = parseRetryAfterFromMessage(result.error.message || '')
        console.log(`Rate limited (body 429), waiting ${delayMs}ms before retry ${attempt + 1}/${maxRetries}`)
        await sleep(delayMs)
        continue
      }
      
      if (!response.ok || result.error) {
        return {
          status: 'Error',
          error: result.error ? `${result.error.code}: ${result.error.message}` : `HTTP ${response.status}: ${responseText}`,
        }
      }
      
      return {
        status: result.status || 'Unknown',
        publicUUID: result.publicUUID,
        raw: result,
      }
    } catch (error: any) {
      if (attempt === maxRetries) {
        return {
          status: 'Error',
          error: error.message || 'Unknown error',
        }
      }
      // For network errors, wait a bit before retry
      await sleep(1000)
    }
  }
  
  return {
    status: 'Error',
    error: 'Max retries exceeded',
  }
}
