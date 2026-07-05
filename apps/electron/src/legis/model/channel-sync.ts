/**
 * model-config → channels.json 同步
 *
 * 把 /auth/me/model-config 返回的 provider 信息包装成"官方渠道"写入 channels.json。
 * 同时禁用所有旧渠道，并切换默认渠道为官方渠道。
 *
 * apiKey 字段写占位符（真 SK 存主进程内存），由 channel-manager 的 decryptApiKey 替换。
 */

import type { ModelConfig } from '../types'

/** 官方渠道固定 ID */
export const OFFICIAL_CHANNEL_ID = 'legis-official'

/** channels.json 里 apiKey 的占位符（真 SK 在主进程内存） */
export const SK_PLACEHOLDER = '__LEGIS_INJECT__'

/**
 * 把 model-config 同步到 channels.json
 *
 * 完整策略：
 * 1. 创建/更新 Legis 官方渠道（apiKey 写占位符）
 * 2. 禁用所有非官方渠道（enabled = false），用户无法切回旧渠道
 * 3. 更新 settings.json：agentChannelId 切到官方渠道
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

    // ---- 步骤 1：创建/更新官方渠道 ----
    const existingOfficial = channels.find((c) => c.id === OFFICIAL_CHANNEL_ID)
    const officialModels = config.provider.models.map((m) => ({
      id: m.id,
      name: m.name,
      enabled: true,
      source: 'fetched' as const,
    }))

    // 保留用户旧的模型勾选偏好
    if (existingOfficial) {
      const oldModelEnabledMap = new Map(
        existingOfficial.models.map((m) => [m.id, m.enabled]),
      )
      officialModels.forEach((m) => {
        m.enabled = oldModelEnabledMap.get(m.id) ?? true
      })
    }

    if (existingOfficial) {
      // 更新官方渠道（不更新 apiKey，保留占位符）
      await window.electronAPI.updateChannel(OFFICIAL_CHANNEL_ID, {
        name: 'Legis 官方',
        baseUrl: config.provider.baseUrl,
        apiKey: '',
        models: officialModels,
        enabled: true,
      })
    } else {
      // 创建官方渠道
      await window.electronAPI.createChannel({
        name: 'Legis 官方',
        provider: 'anthropic',
        baseUrl: config.provider.baseUrl,
        apiKey: SK_PLACEHOLDER,
        models: officialModels,
        enabled: true,
      })
    }

    // ---- 步骤 2：禁用所有非官方渠道 ----
    for (const channel of channels) {
      if (channel.id !== OFFICIAL_CHANNEL_ID && channel.enabled) {
        await window.electronAPI.updateChannel(channel.id, {
          enabled: false,
        })
      }
    }

    // ---- 步骤 3：切换默认渠道为官方渠道 ----
    // 更新 settings.json 的 agentChannelId / agentChannelIds
    const settings = await window.electronAPI.getSettings()
    await window.electronAPI.updateSettings({
      agentChannelId: OFFICIAL_CHANNEL_ID,
      agentChannelIds: [OFFICIAL_CHANNEL_ID],
      // 如果当前默认模型不在新模型列表里，用服务端推荐模型
      agentModelId: config.provider.models.some((m) => m.id === settings.agentModelId)
        ? settings.agentModelId
        : config.provider.selectedModel,
    })
  } catch (error) {
    console.error('[Legis] 同步 model-config 到 channels.json 失败:', error)
  }
}
