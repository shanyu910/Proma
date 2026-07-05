/**
 * model-config → channels.json 同步
 *
 * 通过主进程专用 IPC 'legis:upsert-official-channel' 写入官方渠道，
 * 用固定 ID 'legis-official'（不走 createChannel 的 UUID 生成）。
 *
 * 主进程的 upsertOfficialChannel 同时负责：
 * - 禁用所有旧渠道
 * - 清理重复的旧官方渠道（之前误用 createChannel 创建的）
 * - 用固定 ID 创建/更新官方渠道（apiKey 写占位符）
 */

import type { ModelConfig } from '../types'

/** 官方渠道固定 ID（与主进程 channel-manager.ts 保持一致） */
export const OFFICIAL_CHANNEL_ID = 'legis-official'

/**
 * 把 model-config 同步到 channels.json
 *
 * @param config model-config 响应数据
 * @returns 官方渠道 ID（固定 'legis-official'），失败为 null
 */
export async function syncModelConfigToChannels(config: ModelConfig): Promise<string | null> {
  if (!config.provider || config.status !== 'active') {
    return null
  }

  try {
    // 调主进程专用 IPC（用固定 ID 写渠道，不走 createChannel 的 UUID）
    const channelId = await window.electronAPI.legisChannel.upsertOfficial({
      baseUrl: config.provider.baseUrl,
      models: config.provider.models.map((m) => ({
        id: m.id,
        name: m.name,
        enabled: true,
      })),
      selectedModelId: config.provider.selectedModel,
    })

    // 更新 settings.json：切换默认渠道为官方渠道
    const settings = await window.electronAPI.getSettings()
    await window.electronAPI.updateSettings({
      agentChannelId: OFFICIAL_CHANNEL_ID,
      agentChannelIds: [OFFICIAL_CHANNEL_ID],
      // 如果当前默认模型不在新模型列表里，用服务端推荐模型
      agentModelId: config.provider.models.some((m) => m.id === settings.agentModelId)
        ? settings.agentModelId
        : config.provider.selectedModel,
    })

    return channelId
  } catch (error) {
    console.error('[Legis] 同步 model-config 到 channels.json 失败:', error)
    return null
  }
}
