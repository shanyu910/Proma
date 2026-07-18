/**
 * 登录后状态刷新 —— 把磁盘写入同步到 Jotai atoms
 *
 * 背景：
 * 登录流程会通过 IPC 写磁盘（channels.json、settings.json、runwork-config），
 * 但渲染进程的 atom 不会自动感知磁盘变化。
 * 之前只在 AuthInitializer（自动登录）刷新部分 atom，LoginModal（手动登录）完全没刷新，
 * 导致登录后必须重启应用，AgentView 才能读到 agentChannelId。
 *
 * 本函数集中处理所有需要刷新的 atom，避免分散在各处遗漏。
 */

import { channelsAtom } from '@/atoms/chat-atoms'
import { agentChannelIdAtom, agentChannelIdsAtom, agentModelIdAtom } from '@/atoms/agent-atoms'
import { loadRunWorkConfig, runworkConfigAtom } from '../config/runwork-config'
import { OFFICIAL_CHANNEL_ID } from './channel-sync'

/** Jotai store 类型（来自 useStore() hook 的返回值） */
type JotaiStore = ReturnType<typeof import('jotai').useStore>

/** 登录后需要刷新的全部 atom（统一入口） */
export async function refreshStateAfterLogin(store: JotaiStore): Promise<void> {
  // 1. 刷新 channelsAtom（ModelSelector 读，决定模型列表）
  const channels = await window.electronAPI.listChannels()
  store.set(channelsAtom, channels)

  // 2. 刷新 agentChannelId / agentChannelIds / agentModelId
  //    AgentView 读，决定是否显示"请在设置中选择 Agent 供应商"
  //    channel-sync 已经把 agentChannelId 写入 settings.json，这里同步到 atom
  const settings = await window.electronAPI.getSettings()
  store.set(agentChannelIdAtom, settings.agentChannelId ?? OFFICIAL_CHANNEL_ID)
  store.set(agentChannelIdsAtom, settings.agentChannelIds ?? [OFFICIAL_CHANNEL_ID])
  store.set(agentModelIdAtom, settings.agentModelId ?? null)

  // 3. 刷新 runworkConfigAtom（ModelSelector 按其中的 selectedModelIds 过滤官方渠道模型）
  const freshConfig = await loadRunWorkConfig()
  store.set(runworkConfigAtom, freshConfig)
}
