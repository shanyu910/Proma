/**
 * Legis 用户配置（~/.legis-dev/legis-config.json）
 *
 * 存储用户偏好：模型勾选、默认模型。
 * 与原项目 settings.json 完全隔离，Legis 模块自包含管理。
 */

import { atom } from 'jotai'
import type { LegisConfig } from '../types'

/** 默认配置 */
const DEFAULT_CONFIG: LegisConfig = {
  selectedModelIds: [],
  defaultModelId: '',
}

/** 内存中的配置（通过 loadLegisConfig 从主进程加载） */
export const legisConfigAtom = atom<LegisConfig>(DEFAULT_CONFIG)

/**
 * 从主进程加载 legis-config.json
 *
 * 通过 IPC 调主进程读写文件（避免渲染进程直接碰 fs）。
 * 复用现有的通用文件 IPC（或走 settings 类似模式）。
 *
 * 这里用 localStorage 做轻量持久化的 fallback——
 * 正式实现应走 IPC 文件读写，但 MVP 阶段先用 localStorage。
 */
export async function loadLegisConfig(): Promise<LegisConfig> {
  try {
    const raw = localStorage.getItem('legis-config')
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LegisConfig>
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
export async function saveLegisConfig(config: LegisConfig): Promise<void> {
  try {
    localStorage.setItem('legis-config', JSON.stringify(config))
  } catch (error) {
    console.error('[Legis] 保存配置失败:', error)
  }
}

/**
 * 更新模型勾选
 */
export function updateSelectedModels(
  config: LegisConfig,
  modelIds: string[],
): LegisConfig {
  const updated = { ...config, selectedModelIds: modelIds }
  void saveLegisConfig(updated)
  return updated
}

/**
 * 更新默认模型
 */
export function updateDefaultModel(
  config: LegisConfig,
  modelId: string,
): LegisConfig {
  const updated = { ...config, defaultModelId: modelId }
  void saveLegisConfig(updated)
  return updated
}
