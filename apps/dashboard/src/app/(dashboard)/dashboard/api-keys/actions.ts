'use server'

import {
  createApiKey as apiCreateKey,
  deleteApiKey as apiDeleteKey,
  toggleApiKey as apiToggleKey,
} from '@/lib/api'

export async function createApiKey(name: string) {
  try {
    const result = await apiCreateKey(name)
    return {
      success: true as const,
      data: {
        id: result.id,
        key: result.key,
        name: result.name,
      },
    }
  } catch (error) {
    console.error('Create API key error:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to create API key',
    }
  }
}

export async function deleteApiKey(keyId: string) {
  try {
    await apiDeleteKey(keyId)
    return { success: true as const }
  } catch (error) {
    console.error('Delete API key error:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to delete API key',
    }
  }
}

export async function toggleApiKey(keyId: string, isActive: boolean) {
  try {
    await apiToggleKey(keyId, isActive)
    return { success: true as const }
  } catch (error) {
    console.error('Toggle API key error:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to toggle API key',
    }
  }
}
