/**
 * 远端认证状态管理
 *
 * 对接 Legis-Server 的 /auth/login 和 /auth/me 接口。
 * 服务器地址通过 settings.json 的 authServerUrl 字段配置（默认值见 settings-service.ts）。
 * Token 持久化到 localStorage，启动时自动验证有效性。
 */

import { atom } from 'jotai'

const TOKEN_CACHE_KEY = 'legis-auth-token'

// ---- localStorage 工具 ----

function getCachedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_CACHE_KEY) || null
  } catch {
    return null
  }
}

function cacheToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_CACHE_KEY, token)
  } catch {}
}

function clearCachedToken(): void {
  try {
    localStorage.removeItem(TOKEN_CACHE_KEY)
  } catch {}
}

// ---- 远端用户信息 ----

export interface RemoteUser {
  id: number
  email: string
  fullName: string
  isAdmin: boolean
}

// ---- Atoms ----

/** 认证服务器地址（由 App 初始化时从主进程 settings 注入） */
export const authServerUrlAtom = atom<string>('')

/** 是否已通过认证 */
export const isLoggedInAtom = atom<boolean>(!!getCachedToken())

/** 当前 token */
export const authTokenAtom = atom<string | null>(getCachedToken())

/** 远端用户信息（登录成功后填充） */
export const authUserAtom = atom<RemoteUser | null>(null)

/** 登录错误信息 */
export const loginErrorAtom = atom<string>('')

/** 启动时正在验证 token（用于显示 Loading） */
export const isCheckingAtom = atom<boolean>(!!getCachedToken())

// ---- API 调用 ----

interface LoginResponse {
  success: boolean
  data?: {
    token: string
    user: RemoteUser
  }
  error?: string
}

interface MeResponse {
  success: boolean
  data?: RemoteUser
  error?: string
}

/**
 * 发起登录请求
 *
 * @param serverUrl 认证服务器地址（来自 settings.json）
 */
export async function login(serverUrl: string, email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${serverUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const json: LoginResponse = await res.json()

    if (!json.success || !json.data) {
      return false
    }

    cacheToken(json.data.token)
    return true
  } catch {
    return false
  }
}

/**
 * 用缓存的 token 向服务器验证是否仍然有效
 *
 * @param serverUrl 认证服务器地址（来自 settings.json）
 */
export async function checkSession(
  serverUrl: string,
): Promise<{ valid: boolean; user?: RemoteUser }> {
  const token = getCachedToken()
  if (!token) return { valid: false }

  try {
    const res = await fetch(`${serverUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json: MeResponse = await res.json()

    if (json.success && json.data) {
      return { valid: true, user: json.data }
    }
    return { valid: false }
  } catch {
    return { valid: false }
  }
}

/**
 * 清除持久化 token（不触碰 renderer 内存状态）
 */
export function logout(): void {
  clearCachedToken()
}

export interface LoggedOutAuthStateSetters {
  setLoggedIn: (value: boolean) => void
  setToken: (value: string | null) => void
  setUser: (value: RemoteUser | null) => void
}

/**
 * 清除持久化 token 和当前 renderer 内存登录态。
 *
 * 用于"退出登录"按钮：原子级重置所有 auth atoms，无需 reload 页面。
 */
export function applyLoggedOutAuthState(setters: LoggedOutAuthStateSetters): void {
  logout()
  setters.setToken(null)
  setters.setUser(null)
  setters.setLoggedIn(false)
}
