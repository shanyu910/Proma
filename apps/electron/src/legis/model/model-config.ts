/**
 * 模型配置（SK + 模型列表）管理
 *
 * 对接 GET /auth/me/model-config。
 * SK 安全红线：仅存模块级私有变量，不进 atom（防 DevTools 窥探），绝不写磁盘。
 */

import { atom } from 'jotai'
import { getServerUrl } from '../auth/auth-api'
import type { ModelConfig, ModelConfigResponse, ModelItem } from '../types'

// ---- SK 安全存储（模块级私有变量，不进 atom） ----

/**
 * 当前 SK（API Key），仅存内存。
 *
 * 不放进 atom —— React DevTools 可以读 atom 的值，存模块级变量更安全。
 * App 退出/登出时置 null。
 */
let skInMemory: string | null = null

/**
 * AgentSkill 模型调用地址（从 model-config 的 provider.baseUrl 动态获取）
 */
let agentskillBaseUrl: string | null = null

/**
 * 获取当前 SK（供 Chat/Agent 调模型时使用）
 */
export function getSK(): string | null {
  return skInMemory
}

/**
 * 获取 AgentSkill 模型调用地址
 */
export function getAgentskillBaseUrl(): string | null {
  return agentskillBaseUrl
}

/**
 * 清除内存中的 SK 和 baseUrl（退出登录时调用）
 *
 * 同时清除主进程内存中的 SK。
 */
export async function clearSK(): Promise<void> {
  skInMemory = null
  agentskillBaseUrl = null
  try {
    await window.electronAPI.legisSK.clearSK()
  } catch {
    // ignore
  }
}

// ---- Atoms ----

/** 完整的 model-config 响应（含 provider + binding） */
export const modelConfigAtom = atom<ModelConfig | null>(null)

/** 可用模型列表（provider.models 的便捷访问） */
export const availableModelsAtom = atom<ModelItem[]>([])

/** 服务端推荐的默认模型 ID */
export const recommendedModelIdAtom = atom<string>('')

/** model-config 的加载状态 */
export const modelConfigLoadingAtom = atom<boolean>(false)

/** model-config 错误信息（如 status=failed 时的 lastError） */
export const modelConfigErrorAtom = atom<string>('')

// ---- API 调用 ----

/**
 * 拉取模型配置（GET /auth/me/model-config）
 *
 * 拉取成功后：
 * 1. SK 存入模块级私有变量（仅内存）
 * 2. provider.baseUrl 存入模块级变量
 * 3. models / selectedModel 存入 atom
 *
 * @param token Bearer Token
 * @returns 成功为 true，失败为 false
 */
export async function fetchModelConfig(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${getServerUrl()}/auth/me/model-config`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const json: ModelConfigResponse = await res.json()

    if (!json.success || !json.data) {
      return false
    }

    const config = json.data

    // status 非 active 时，SK 不可用
    if (config.status !== 'active' || !config.provider) {
      skInMemory = null
      agentskillBaseUrl = null
      return false
    }

    // SK 仅存内存
    skInMemory = config.provider.apiKey
    agentskillBaseUrl = config.provider.baseUrl

    // 通过 atom 的 store 在组件层设置
    // 这里只返回 config，由调用方设置 atom
    return true
  } catch {
    return false
  }
}

/**
 * 拉取模型配置并返回完整数据（供 AuthInitializer / store 操作 atom 用）
 *
 * @param token Bearer Token
 * @returns ModelConfig 或 null
 */
export async function fetchModelConfigData(token: string): Promise<ModelConfig | null> {
  try {
    const res = await fetch(`${getServerUrl()}/auth/me/model-config`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const json: ModelConfigResponse = await res.json()

    if (!json.success || !json.data) {
      return null
    }

    const config = json.data

    // status 非 active 时清除 SK
    if (config.status !== 'active' || !config.provider) {
      skInMemory = null
      agentskillBaseUrl = null
      return config // 仍返回 config（含 binding.lastError 供 UI 展示）
    }

    // SK 仅存内存
    skInMemory = config.provider.apiKey
    agentskillBaseUrl = config.provider.baseUrl

    // 同步 SK 到主进程内存（供主进程 decryptApiKey 读取）
    try {
      await window.electronAPI.legisSK.setSK(skInMemory)
    } catch {
      console.error('[Legis] SK 同步到主进程失败')
    }

    return config
  } catch {
    return null
  }
}

/**
 * SK 失效后自动重拉（AgentSkill 返回 401 时调用）
 *
 * @param token Bearer Token
 * @returns 新 SK，或 null（仍然失败）
 */
export async function refreshSK(token: string): Promise<string | null> {
  const config = await fetchModelConfigData(token)
  if (config && config.status === 'active' && config.provider) {
    return skInMemory
  }
  return null
}
