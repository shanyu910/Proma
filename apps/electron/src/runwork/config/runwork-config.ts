/**
 * RunWork 用户配置（~/.runwork-dev/runwork-config.json）
 *
 * 存储用户偏好：模型勾选、默认模型。
 * 与原项目 settings.json 完全隔离，RunWork 模块自包含管理。
 */

import { atom } from 'jotai'
import type { RunWorkConfig } from '../types'

/** 默认配置 */
const DEFAULT_CONFIG: RunWorkConfig = {
  selectedModelIds: [],
  defaultModelId: '',
}

/** 内存中的配置（通过 loadRunWorkConfig 从主进程加载） */
export const runworkConfigAtom = atom<RunWorkConfig>(DEFAULT_CONFIG)

/**
 * 从主进程加载 runwork-config.json
 *
 * 通过 IPC 调主进程读写文件（避免渲染进程直接碰 fs）。
 * 复用现有的通用文件 IPC（或走 settings 类似模式）。
 *
 * 这里用 localStorage 做轻量持久化的 fallback——
 * 正式实现应走 IPC 文件读写，但 MVP 阶段先用 localStorage。
 */
export async function loadRunWorkConfig(): Promise<RunWorkConfig> {
  try {
    const raw = localStorage.getItem('runwork-config')
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RunWorkConfig>
      return {
        selectedModelIds: parsed.selectedModelIds ?? [],
        defaultModelId: parsed.defaultModelId ?? '',
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG
}

/**
 * 持久化配置
 */
export async function saveRunWorkConfig(config: RunWorkConfig): Promise<void> {
  try {
    localStorage.setItem('runwork-config', JSON.stringify(config))
  } catch (error) {
    console.error('[RunWork] 保存配置失败:', error)
  }
}

/**
 * 更新模型勾选
 */
export function updateSelectedModels(
  config: RunWorkConfig,
  modelIds: string[],
): RunWorkConfig {
  const updated = { ...config, selectedModelIds: modelIds }
  void saveRunWorkConfig(updated)
  return updated
}

/**
 * 更新默认模型
 */
export function updateDefaultModel(
  config: RunWorkConfig,
  modelId: string,
): RunWorkConfig {
  const updated = { ...config, defaultModelId: modelId }
  void saveRunWorkConfig(updated)
  return updated
}
