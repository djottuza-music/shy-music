import type { Role } from '../types'

export type AccountMode = 'listener' | 'artist'

const STORAGE_KEY = 'shy-account-mode'

export function canUseAccountMode(roles: Role[], mode: AccountMode) {
  return mode === 'listener' || roles.includes('artist') || roles.includes('admin')
}

export function readAccountMode(): AccountMode {
  return localStorage.getItem(STORAGE_KEY) === 'artist' ? 'artist' : 'listener'
}

export function storeAccountMode(mode: AccountMode) {
  localStorage.setItem(STORAGE_KEY, mode)
}
