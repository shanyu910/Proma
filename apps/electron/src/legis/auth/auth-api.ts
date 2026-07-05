/**
 * 认证 API 调用
 *
 * 对接 Legis-Server 的 /auth/* 接口。
 * 服务器地址从 .env 的 VITE_LEGIS_SERVER_URL 读取。
 *
 * 错误处理：fetch 不会因 4xx/5xx 抛异常，所有调用都检查 res.ok + json 格式。
 */

import type {
  LegisUser,
  LoginResponse,
  MeResponse,
  ChangePasswordResponse,
} from '../types'

/**
 * Legis-Server 地址（构建期注入，来自 .env）
 *
 * 开发时 Vite 从 apps/electron/.env 读取。
 * fallback 为接口验证时确认的地址。
 */
const SERVER_URL: string =
  import.meta.env.VITE_LEGIS_SERVER_URL || 'http://14.103.216.135:31006'

/**
 * 登录结果
 *
 * 成功时返回 { token, user }，失败时返回 { error }（含服务端错误文案）。
 */
export interface LoginResult {
  success: boolean
  token?: string
  user?: LegisUser
  error?: string
  code?: string
}

/**
 * 发起登录请求
 *
 * @param email 邮箱
 * @param password 密码
 * @returns LoginResult（成功含 token+user，失败含 error 文案）
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${SERVER_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })

    const json: LoginResponse = await res.json()

    if (json.success && json.data) {
      return {
        success: true,
        token: json.data.token,
        user: json.data.user,
      }
    }

    return {
      success: false,
      error: json.error || '账号或密码错误',
      code: json.code,
    }
  } catch {
    return {
      success: false,
      error: '无法连接认证服务器，请检查网络',
    }
  }
}

/**
 * 验证 Token 并获取用户信息
 *
 * @param token Bearer Token
 * @returns 用户信息（有效），或 null（无效/过期）
 */
export async function checkSession(
  token: string,
): Promise<{ valid: boolean; user?: LegisUser; code?: string }> {
  try {
    const res = await fetch(`${SERVER_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const json: MeResponse = await res.json()

    if (json.success && json.data) {
      return { valid: true, user: json.data }
    }

    return { valid: false, code: json.code }
  } catch {
    return { valid: false }
  }
}

/**
 * 修改密码
 *
 * @param token Bearer Token
 * @param currentPassword 当前密码
 * @param newPassword 新密码（至少 8 位）
 * @returns 成功为 true，失败含错误文案
 */
export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SERVER_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    })

    const json: ChangePasswordResponse = await res.json()

    if (json.success) {
      return { success: true }
    }

    return { success: false, error: json.error || '修改密码失败' }
  } catch {
    return { success: false, error: '无法连接服务器，请检查网络' }
  }
}

/**
 * 获取 Legis-Server 地址（供其他模块使用，如 model-config）
 */
export function getServerUrl(): string {
  return SERVER_URL
}

/**
 * 修改个人资料（姓名）
 *
 * 对接 POST /auth/me/profile。
 * 仅支持修改 fullName，不需要当前密码二次校验。
 * 成功后返回更新后的完整用户信息。
 *
 * @param token Bearer Token
 * @param fullName 新姓名（去首尾空白后不能为空）
 * @returns 成功含更新后的 user，失败含 error 文案
 */
export async function updateProfile(
  token: string,
  fullName: string,
): Promise<{ success: boolean; user?: LegisUser; error?: string }> {
  try {
    const res = await fetch(`${SERVER_URL}/auth/me/profile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullName: fullName.trim() }),
    })

    const json: MeResponse = await res.json()

    if (json.success && json.data) {
      return { success: true, user: json.data }
    }

    return { success: false, error: json.error || '修改失败' }
  } catch {
    return { success: false, error: '无法连接服务器，请检查网络' }
  }
}
