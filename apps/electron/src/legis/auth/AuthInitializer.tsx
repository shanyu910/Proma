/**
 * AuthInitializer — 启动时静默验证 Token
 *
 * 挂在 App 根组件，不渲染任何 UI（返回 null）。
 * 启动时从 Keychain 读 Token，调 /auth/me 验证：
 *   - 有效 → authStatus = 'authenticated'，拉取 model-config + model-usage
 *   - 无效 → 清 Keychain，authStatus = 'guest'
 *   - 无 Token → authStatus = 'guest'
 */

import { useEffect, type ReactElement } from 'react'
import { useStore } from 'jotai'
import {
  authStatusAtom,
  authUserAtom,
  getStoredToken,
  clearStoredToken,
} from './auth-state'
import { checkSession } from './auth-api'
import { fetchModelConfigData, clearSK, modelConfigAtom, recommendedModelIdAtom } from '../model/model-config'
import { fetchModelUsage, modelUsageAtom } from '../model/model-usage'
import { syncModelConfigToChannels } from '../model/channel-sync'
import { loadLegisConfig, legisConfigAtom } from '../config/legis-config'
import { refreshStateAfterLogin } from '../model/post-login-refresh'

export function AuthInitializer(): ReactElement | null {
  const store = useStore()

  useEffect(() => {
    let cancelled = false

    const init = async (): Promise<void> => {
      // 加载用户配置（模型勾选等）
      const config = await loadLegisConfig()
      if (!cancelled) {
        store.set(legisConfigAtom, config)
      }

      // 从 Keychain 读 Token
      const token = await getStoredToken()
      if (!token) {
        if (!cancelled) store.set(authStatusAtom, 'guest')
        return
      }

      // 验证 Token
      const result = await checkSession(token)
      if (cancelled) return

      if (result.valid && result.user) {
        // Token 有效
        store.set(authStatusAtom, 'authenticated')
        store.set(authUserAtom, result.user)

        // 用服务端 fullName 同步本地 userProfile
        try {
          await window.electronAPI.updateUserProfile({ userName: result.user.fullName })
        } catch {
          // 非关键路径，忽略
        }

        // 拉取 model-config（SK + 模型列表）
        const modelConfig = await fetchModelConfigData(token)
        if (cancelled) return

        if (modelConfig) {
          store.set(modelConfigAtom, modelConfig)
          // 设置推荐模型 ID（供 ModelManagementPanel 显示"推荐"标签）
          if (modelConfig.provider?.selectedModel) {
            store.set(recommendedModelIdAtom, modelConfig.provider.selectedModel)
          }
          // 同步到 channels.json + settings.json（写磁盘）
          await syncModelConfigToChannels(modelConfig)
          // 刷新全部相关 atom（channelsAtom + agentChannelIdAtom + legisConfigAtom）
          // 修复 bug：之前只写磁盘不刷 atom，登录后 AgentView 显示"请选择供应商"、必须重启
          if (!cancelled) {
            await refreshStateAfterLogin(store)
          }
        }

        // 拉取余额
        const usage = await fetchModelUsage(token)
        if (cancelled) return
        if (usage) {
          store.set(modelUsageAtom, usage)
        }
      } else {
        // Token 无效，清除
        await clearStoredToken()
        await clearSK()
        store.set(authStatusAtom, 'guest')
        store.set(authUserAtom, null)
      }
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
