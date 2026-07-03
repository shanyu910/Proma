import { describe, expect, test } from 'bun:test'
import { createStore } from 'jotai'
import {
  applyLoggedOutAuthState,
  authTokenAtom,
  authUserAtom,
  isLoggedInAtom,
  type RemoteUser,
} from './auth'

describe('auth logout state', () => {
  test('clears runtime auth atoms without requiring a window reload', () => {
    const store = createStore()
    const user: RemoteUser = {
      id: 1,
      email: 'user@example.com',
      fullName: 'User Example',
      isAdmin: false,
    }

    store.set(isLoggedInAtom, true)
    store.set(authTokenAtom, 'token-123')
    store.set(authUserAtom, user)

    applyLoggedOutAuthState({
      setLoggedIn: (value) => store.set(isLoggedInAtom, value),
      setToken: (value) => store.set(authTokenAtom, value),
      setUser: (value) => store.set(authUserAtom, value),
    })

    expect(store.get(isLoggedInAtom)).toBe(false)
    expect(store.get(authTokenAtom)).toBeNull()
    expect(store.get(authUserAtom)).toBeNull()
  })
})
