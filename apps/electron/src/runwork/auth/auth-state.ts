/**
 * 认证状态管理
 *
 * 管理认证状态 atoms + Token 的 Keychain 安全存储。
 * 所有持久化 Token 的读写都通过 IPC 调用主进程的 safeStorage。
 */

import { atom } from 'jotai'
import type { AuthStatus, RunWorkUser, LoginModalState } from '../types'

// ---- Atoms ----

/** 认证状态：loading（启动时验证中）/ authenticated / guest */
export const authStatusAtom = atom<AuthStatus>('loading')

/** 当前登录用户信息（authenticated 状态下有值） */
export const authUserAtom = atom<RunWorkUser | null>(null)

/** 登录弹窗状态（由 useRequireAuth 触发） */
export const loginModalAtom = atom<LoginModalState>({
  open: false,
  reason: '',
  onSuccess: null,
})

/** 改密弹窗状态（mustChangePassword 时触发） */
export const changePasswordModalAtom = atom<{ open: boolean; reason: string }>({
  open: false,
  reason: '',
})

// ---- Token 安全存储（通过 IPC 调主进程 Keychain） ----

/**
 * 从 Keychain 读取 Token
 *
 * @returns Token 明文，无则 null
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    return await window.electronAPI.authSecure.getToken()
  } catch (error) {
    console.error('[RunWork Auth] 读取 Token 失败:', error)
    return null
  }
}

/**
 * 将 Token 加密存入 Keychain
 */
export async function setStoredToken(token: string): Promise<void> {
  try {
    await window.electronAPI.authSecure.setToken(token)
  } catch (error) {
    console.error('[RunWork Auth] 存储 Token 失败:', error)
  }
}

/**
 * 从 Keychain 清除 Token
 */
export async function clearStoredToken(): Promise<void> {
  try {
    await window.electronAPI.authSecure.clearToken()
  } catch (error) {
    console.error('[RunWork Auth] 清除 Token 失败:', error)
  }
}
