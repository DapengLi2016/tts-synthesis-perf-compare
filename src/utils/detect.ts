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
 * Call the Provenance Detect API using API Key authentication
 * @param detectUrl The Content Safety detect endpoint URL
 * @param apiKey The Content Safety API key
 * @param audioData The audio data as ArrayBuffer
 * @param mimeType The MIME type of the audio (e.g., 'audio/wav', 'audio/mpeg')
 */
export async function detectWatermarkWithKey(
  detectUrl: string,
  apiKey: string,
  audioData: ArrayBuffer,
  mimeType: string = 'audio/wav'
): Promise<DetectResult> {
  try {
    // Convert audio data to base64
    const base64Data = arrayBufferToBase64(audioData)
    
    // Build the detect request
    const requestBody = {
      mimeType: mimeType,
      data: base64Data,
    }
    
    // Call the detect API (remove trailing slash from URL if present)
    const baseUrl = detectUrl.replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/contentsafety/provenance:detect?api-version=2025-09-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': apiKey,
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
 * Call the Provenance Detect API using Bearer token authentication
 * @param detectUrl The Content Safety detect endpoint URL
 * @param token The Bearer access token (e.g., from az account get-access-token)
 * @param audioData The audio data as ArrayBuffer
 * @param mimeType The MIME type of the audio (e.g., 'audio/wav', 'audio/mpeg')
 */
export async function detectWatermarkWithToken(
  detectUrl: string,
  token: string,
  audioData: ArrayBuffer,
  mimeType: string = 'audio/wav'
): Promise<DetectResult> {
  try {
    // Convert audio data to base64
    const base64Data = arrayBufferToBase64(audioData)
    
    // Build the detect request
    const requestBody = {
      mimeType: mimeType,
      data: base64Data,
    }
    
    // Call the detect API (remove trailing slash from URL if present)
    const baseUrl = detectUrl.replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/contentsafety/provenance:detect?api-version=2025-09-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
