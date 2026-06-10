import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'

// MSAL configuration for Azure AD authentication (same as detect.ts)
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

// Scope for Azure Storage
const storageScope = 'https://storage.azure.com/.default'

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
          console.log('MSAL Storage: Logged in via redirect:', response.account?.username)
        }
      } catch (error: any) {
        if (error.errorCode !== 'no_token_request_cache_error') {
          console.error('MSAL Storage redirect error:', error)
        }
      }
    })()
  }
  await redirectHandlePromise
  
  return msalInstance
}

/**
 * Get an access token for Azure Storage using MSAL (same flow as detect.ts)
 */
export async function getStorageAccessToken(): Promise<string> {
  const msal = await getMsalInstance()
  const accounts = msal.getAllAccounts()
  console.log('Storage MSAL accounts found:', accounts.length)
  
  if (accounts.length > 0) {
    try {
      console.log('Trying silent storage token acquisition for:', accounts[0].username)
      const response = await msal.acquireTokenSilent({
        scopes: [storageScope],
        account: accounts[0],
      })
      console.log('Silent storage token acquired successfully')
      return response.accessToken
    } catch (error) {
      console.log('Silent storage token acquisition failed:', error)
      if (error instanceof InteractionRequiredAuthError) {
        console.log('Interaction required, redirecting to login for storage...')
        await msal.acquireTokenRedirect({
          scopes: [storageScope],
        })
        throw new Error('Redirecting to login...')
      }
      throw error
    }
  }
  
  // No accounts - start redirect login
  console.log('No accounts found, starting storage login redirect...')
  await msal.acquireTokenRedirect({
    scopes: [storageScope],
  })
  throw new Error('Redirecting to login...')
}

/**
 * Check if user is logged in (has MSAL accounts)
 */
export async function isStorageLoggedIn(): Promise<boolean> {
  const msal = await getMsalInstance()
  return msal.getAllAccounts().length > 0
}

// User Delegation Key interface
interface UserDelegationKey {
  signedOid: string
  signedTid: string
  signedStart: string
  signedExpiry: string
  signedService: string
  signedVersion: string
  value: string
}

/**
 * Parse User Delegation Key from XML response
 */
function parseUserDelegationKey(xml: string): UserDelegationKey {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  
  const getValue = (name: string): string => {
    const el = doc.getElementsByTagName(name)[0]
    return el?.textContent || ''
  }
  
  return {
    signedOid: getValue('SignedOid'),
    signedTid: getValue('SignedTid'),
    signedStart: getValue('SignedStart'),
    signedExpiry: getValue('SignedExpiry'),
    signedService: getValue('SignedService'),
    signedVersion: getValue('SignedVersion'),
    value: getValue('Value'),
  }
}

/**
 * Generate HMAC-SHA256 signature using Web Crypto API
 */
async function computeHmacSha256(key: ArrayBuffer, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const messageBuffer = encoder.encode(message)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer)
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/**
 * Generate a User Delegation SAS URL for a blob
 * @param blobUrl The blob URL (without SAS)
 * @returns The blob URL with SAS token appended
 */
export async function generateBlobSasUrl(blobUrl: string): Promise<string> {
  const token = await getStorageAccessToken()
  
  // Parse the blob URL to get storage account and container/blob path
  const url = new URL(blobUrl)
  const storageAccount = url.hostname.split('.')[0]
  const pathParts = url.pathname.split('/').filter(p => p)
  const containerName = pathParts[0]
  const blobPath = pathParts.slice(1).join('/')
  
  // Set time range for the SAS
  const now = new Date()
  const start = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago (clock skew)
  const expiry = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
  
  const formatTime = (d: Date) => d.toISOString().split('.')[0] + 'Z'
  const keyStart = formatTime(start)
  const keyExpiry = formatTime(expiry)
  
  // Get User Delegation Key
  const keyRequestBody = `<?xml version="1.0" encoding="utf-8"?>
<KeyInfo>
  <Start>${keyStart}</Start>
  <Expiry>${keyExpiry}</Expiry>
</KeyInfo>`
  
  const keyResponse = await fetch(
    `https://${storageAccount}.blob.core.windows.net/?restype=service&comp=userdelegationkey`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-ms-version': '2020-02-10',
        'Content-Type': 'application/xml',
      },
      body: keyRequestBody,
    }
  )
  
  if (!keyResponse.ok) {
    const errorText = await keyResponse.text()
    throw new Error(`Failed to get user delegation key: ${keyResponse.status} - ${errorText}`)
  }
  
  const keyXml = await keyResponse.text()
  const delegationKey = parseUserDelegationKey(keyXml)
  
  // SAS parameters
  const sv = '2020-02-10' // Signed version
  const sr = 'b' // Signed resource: blob
  const sp = 'r' // Signed permissions: read
  const st = keyStart // Signed start
  const se = keyExpiry // Signed expiry
  const skoid = delegationKey.signedOid
  const sktid = delegationKey.signedTid
  const skt = delegationKey.signedStart
  const ske = delegationKey.signedExpiry
  const sks = 'b' // Signed key service: blob
  const skv = delegationKey.signedVersion
  const spr = 'https' // Signed protocol
  
  // Canonical resource
  const canonicalResource = `/blob/${storageAccount}/${containerName}/${blobPath}`
  
  // String to sign (order matters!)
  const stringToSign = [
    sp,           // signedPermissions
    st,           // signedStart
    se,           // signedExpiry
    canonicalResource,
    skoid,        // signedOid
    sktid,        // signedTid
    skt,          // signedKeyStart
    ske,          // signedKeyExpiry
    sks,          // signedKeyService
    skv,          // signedKeyVersion
    '',           // signedAuthorizedOid (empty)
    '',           // signedUnauthorizedOid (empty)
    '',           // signedCorrelationId (empty)
    '',           // signedIP (empty)
    spr,          // signedProtocol
    sv,           // signedVersion
    sr,           // signedResource
    '',           // signedSnapshotTime (empty)
    '',           // signedEncryptionScope (empty)
    '',           // rscc (Cache-Control)
    '',           // rscd (Content-Disposition)
    '',           // rsce (Content-Encoding)
    '',           // rscl (Content-Language)
    '',           // rsct (Content-Type)
  ].join('\n')
  
  // Compute signature
  const keyBytes = Uint8Array.from(atob(delegationKey.value), c => c.charCodeAt(0))
  const sig = await computeHmacSha256(keyBytes.buffer, stringToSign)
  
  // Build SAS query string
  const sasParams = new URLSearchParams({
    sv,
    sr,
    st,
    se,
    sp,
    skoid,
    sktid,
    skt,
    ske,
    sks,
    skv,
    spr,
    sig,
  })
  
  const sasUrl = `${url.origin}${url.pathname}?${sasParams.toString()}`
  console.log('Generated User Delegation SAS URL for:', blobPath)
  
  return sasUrl
}

// Manual token storage
let manualStorageToken: string | null = null

export function setManualStorageToken(token: string) {
  manualStorageToken = token
}

export function getManualStorageToken(): string | null {
  return manualStorageToken
}

export function clearManualStorageToken() {
  manualStorageToken = null
}

/**
 * Generate a User Delegation SAS URL using a manual token
 */
export async function generateBlobSasUrlWithToken(blobUrl: string, token: string): Promise<string> {
  // Parse the blob URL to get storage account and container/blob path
  const url = new URL(blobUrl)
  const storageAccount = url.hostname.split('.')[0]
  const pathParts = url.pathname.split('/').filter(p => p)
  const containerName = pathParts[0]
  const blobPath = pathParts.slice(1).join('/')
  
  // Set time range for the SAS
  const now = new Date()
  const start = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago (clock skew)
  const expiry = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
  
  const formatTime = (d: Date) => d.toISOString().split('.')[0] + 'Z'
  const keyStart = formatTime(start)
  const keyExpiry = formatTime(expiry)
  
  // Get User Delegation Key
  const keyRequestBody = `<?xml version="1.0" encoding="utf-8"?>
<KeyInfo>
  <Start>${keyStart}</Start>
  <Expiry>${keyExpiry}</Expiry>
</KeyInfo>`
  
  const keyResponse = await fetch(
    `https://${storageAccount}.blob.core.windows.net/?restype=service&comp=userdelegationkey`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-ms-version': '2020-02-10',
        'Content-Type': 'application/xml',
      },
      body: keyRequestBody,
    }
  )
  
  if (!keyResponse.ok) {
    const errorText = await keyResponse.text()
    throw new Error(`Failed to get user delegation key: ${keyResponse.status} - ${errorText}`)
  }
  
  const keyXml = await keyResponse.text()
  const delegationKey = parseUserDelegationKey(keyXml)
  
  // SAS parameters
  const sv = '2020-02-10'
  const sr = 'b'
  const sp = 'r'
  const st = keyStart
  const se = keyExpiry
  const skoid = delegationKey.signedOid
  const sktid = delegationKey.signedTid
  const skt = delegationKey.signedStart
  const ske = delegationKey.signedExpiry
  const sks = 'b'
  const skv = delegationKey.signedVersion
  const spr = 'https'
  
  const canonicalResource = `/blob/${storageAccount}/${containerName}/${blobPath}`
  
  const stringToSign = [
    sp, st, se, canonicalResource,
    skoid, sktid, skt, ske, sks, skv,
    '', '', '', '', spr, sv, sr, '', '', '', '', '', '', ''
  ].join('\n')
  
  const keyBytes = Uint8Array.from(atob(delegationKey.value), c => c.charCodeAt(0))
  const sig = await computeHmacSha256(keyBytes.buffer, stringToSign)
  
  const sasParams = new URLSearchParams({
    sv, sr, st, se, sp, skoid, sktid, skt, ske, sks, skv, spr, sig,
  })
  
  return `${url.origin}${url.pathname}?${sasParams.toString()}`
}
