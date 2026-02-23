/**
 * Image Utilities
 *
 * Shared utilities for handling images across LLM providers.
 * Includes fetching, base64 conversion, and MIME type detection.
 */

import type { ImageInput } from './types'

// ─── Constants ───────────────────────────────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
]

const DEFAULT_TIMEOUT = 10000 // 10 seconds

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FetchedImage {
  base64: string
  mimeType: string
  originalUrl: string
  size: number
}

export interface ImageFetchOptions {
  timeout?: number
  userAgent?: string
  maxRetries?: number
}

// ─── Image Fetching ──────────────────────────────────────────────────────────

/**
 * Get a random user agent for requests
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Detect MIME type from content-type header or URL
 */
export function detectMimeType(contentType: string | null, url?: string): string {
  if (contentType) {
    if (contentType.includes('png')) return 'image/png'
    if (contentType.includes('webp')) return 'image/webp'
    if (contentType.includes('gif')) return 'image/gif'
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'image/jpeg'
  }

  if (url) {
    const lowerUrl = url.toLowerCase()
    if (lowerUrl.includes('.png')) return 'image/png'
    if (lowerUrl.includes('.webp')) return 'image/webp'
    if (lowerUrl.includes('.gif')) return 'image/gif'
  }

  return 'image/jpeg' // Default
}

/**
 * Fetch an image and convert to base64
 */
export async function fetchImageAsBase64(
  url: string,
  options?: ImageFetchOptions
): Promise<FetchedImage | null> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT
  const userAgent = options?.userAgent ?? getRandomUserAgent()
  const maxRetries = options?.maxRetries ?? 2

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'image/*',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      const arrayBuffer = await response.arrayBuffer()
      const base64 = arrayBufferToBase64(arrayBuffer)
      const mimeType = detectMimeType(contentType, url)

      return {
        base64,
        mimeType,
        originalUrl: url,
        size: arrayBuffer.byteLength,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on abort
      if (error instanceof Error && error.name === 'AbortError') {
        break
      }

      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
      }
    }
  }

  console.error(`Failed to fetch image ${url}:`, lastError?.message)
  return null
}

/**
 * Fetch multiple images concurrently
 */
export async function fetchImagesAsBase64(
  urls: string[],
  options?: ImageFetchOptions & { concurrency?: number }
): Promise<Map<string, FetchedImage>> {
  const concurrency = options?.concurrency ?? 5
  const results = new Map<string, FetchedImage>()

  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const result = await fetchImageAsBase64(url, options)
        return { url, result }
      })
    )

    for (const { url, result } of batchResults) {
      if (result) {
        results.set(url, result)
      }
    }
  }

  return results
}

/**
 * Prepare images for LLM provider
 * Fetches URL-based images and converts to base64 if needed
 */
export async function prepareImagesForProvider(
  images: ImageInput[],
  options?: ImageFetchOptions
): Promise<Array<{ base64: string; mimeType: string }>> {
  const results: Array<{ base64: string; mimeType: string }> = []

  for (const image of images) {
    // Already has base64
    if (image.base64) {
      results.push({
        base64: image.base64,
        mimeType: image.mimeType || 'image/jpeg',
      })
      continue
    }

    // Need to fetch
    if (image.url) {
      const fetched = await fetchImageAsBase64(image.url, options)
      if (fetched) {
        results.push({
          base64: fetched.base64,
          mimeType: fetched.mimeType,
        })
      }
    }
  }

  return results
}

/**
 * Create a data URL from base64 and mime type
 */
export function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`
}

/**
 * Check if a URL is a data URL
 */
export function isDataUrl(url: string): boolean {
  return url.startsWith('data:')
}

/**
 * Parse a data URL into base64 and mime type
 */
export function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    base64: match[2],
  }
}
