/**
 * 模型用量与余额
 *
 * 对接 GET /auth/me/model-usage。
 * 服务端每次调用会反向同步上游 AgentSkill，返回实时数据（约 200ms 延迟）。
 */

import { atom } from 'jotai'
import { getServerUrl } from '../auth/auth-api'
import type { ModelUsage, ModelUsageResponse } from '../types'

// ---- Atoms ----

/** 余额与用量数据 */
export const modelUsageAtom = atom<ModelUsage | null>(null)

/** 用量加载状态 */
export const modelUsageLoadingAtom = atom<boolean>(false)

// ---- API 调用 ----

/**
 * 拉取实时余额（GET /auth/me/model-usage）
 *
 * 注意：服务端会反向同步上游，有约 200ms 额外延迟。
 *
 * @param token Bearer Token
 * @returns ModelUsage 数据，或 null（失败）
 */
export async function fetchModelUsage(token: string): Promise<ModelUsage | null> {
  try {
    const res = await fetch(`${getServerUrl()}/auth/me/model-usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const json: ModelUsageResponse = await res.json()

    if (json.success && json.data) {
      return json.data
    }
    return null
  } catch {
    return null
  }
}
