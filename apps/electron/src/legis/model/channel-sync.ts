/**
 * model-config → channels.json 同步
 *
 * 把 /auth/me/model-config 返回的 provider 信息包装成"官方渠道"写入 channels.json。
 * apiKey 字段写占位符（真 SK 仅内存），由 Chat/Agent 调模型前替换。
 */

import type { ModelConfig } from '../types'

/** 官方渠道固定 ID */
export const OFFICIAL_CHANNEL_ID = 'legis-official'

/** channels.json 里 apiKey 的占位符（真 SK 在 model-config.ts 的模块级变量里） */
export const SK_PLACEHOLDER = '__LEGIS_INJECT__'

/**
 * 把 model-config 同步到 channels.json
 *
 * 策略：
 * - 如果已有 OFFICIAL_CHANNEL_ID 渠道，更新它（保留用户模型勾选状态）
 * - 如果没有，追加一个
 * - apiKey 永远写占位符，真 SK 仅内存
 *
 * @param config model-config 响应数据
 */
export async function syncModelConfigToChannels(config: ModelConfig): Promise<void> {
  if (!config.provider || config.status !== 'active') {
    return
  }

  try {
    // 读现有渠道
    const channels = await window.electronAPI.listChannels()
    const existingIndex = channels.findIndex((c) => c.id === OFFICIAL_CHANNEL_ID)

    // 构造官方渠道数据
    const officialChannel = {
      id: OFFICIAL_CHANNEL_ID,
      name: 'Legis 官方',
      provider: 'anthropic' as const,
      baseUrl: config.provider.baseUrl,
      apiKey: SK_PLACEHOLDER,
      models: config.provider.models.map((m) => ({
        id: m.id,
        name: m.name,
        enabled: true,
        source: 'fetched' as const,
      })),
      enabled: true,
      createdAt: existingIndex >= 0 ? channels[existingIndex]!.createdAt : Date.now(),
      updatedAt: Date.now(),
    }

    if (existingIndex >= 0) {
      // 更新（保留用户是否启用各模型的偏好——通过 models enabled 字段）
      const oldChannel = channels[existingIndex]!
      const oldModelEnabledMap = new Map(
        oldChannel.models.map((m) => [m.id, m.enabled]),
      )

      // 用新的模型列表，但保留用户旧的 enabled 偏好
      officialChannel.models = officialChannel.models.map((m) => ({
        ...m,
        enabled: oldModelEnabledMap.get(m.id) ?? true,
      }))

      channels[existingIndex] = { ...oldChannel, ...officialChannel }
    } else {
      channels.push(officialChannel)
    }

    // 用 createChannel/updateChannel 走 IPC（触发持久化）
    // 但这两个接口会加密 apiKey——SK_PLACEHOLDER 是占位符，加密也没关系
    if (existingIndex >= 0) {
      await window.electronAPI.updateChannel(OFFICIAL_CHANNEL_ID, {
        name: officialChannel.name,
        baseUrl: officialChannel.baseUrl,
        apiKey: '', // 空字符串表示不更新 apiKey
        models: officialChannel.models,
        enabled: true,
      })
    } else {
      await window.electronAPI.createChannel({
        name: officialChannel.name,
        provider: officialChannel.provider,
        baseUrl: officialChannel.baseUrl,
        apiKey: SK_PLACEHOLDER,
        models: officialChannel.models,
        enabled: true,
      })
    }
  } catch (error) {
    console.error('[Legis] 同步 model-config 到 channels.json 失败:', error)
  }
}

/**
 * 解析渠道的 apiKey：如果是占位符，替换为内存中的真实 SK
 *
 * Chat/Agent 调模型前调用此函数。
 *
 * @param channelApiKey 渠道的 apiKey 字段值
 * @returns 真实 SK 或原值
 */
export function resolveApiKey(channelApiKey: string): string {
  if (channelApiKey === SK_PLACEHOLDER) {
    // 从 model-config.ts 的模块级变量获取（通过延迟 import 避免循环依赖）
    const { getSK } = require('./model-config')
    return getSK() || ''
  }
  return channelApiKey
}
