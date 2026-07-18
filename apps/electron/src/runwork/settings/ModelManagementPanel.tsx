/**
 * ModelManagementPanel — 模型管理设置页
 *
 * 替换原 ChannelSettings，展示：余额 + 模型勾选 + 默认模型。
 * 不出现"渠道"概念。
 */

import { useEffect, useState, type ReactElement } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { RefreshCw, ExternalLink, Check } from 'lucide-react'
import { channelsAtom } from '@/atoms/chat-atoms'
import {
  authStatusAtom,
  loginModalAtom,
} from '../auth/auth-state'
import {
  modelConfigAtom,
  recommendedModelIdAtom,
} from '../model/model-config'
import { modelUsageAtom, fetchModelUsage } from '../model/model-usage'
import {
  runworkConfigAtom,
  updateSelectedModels,
  updateDefaultModel,
} from '../config/runwork-config'
import { getStoredToken } from '../auth/auth-state'
import type { ModelItem } from '../types'

/** AgentSkill 网站地址（用户购买余量） */
const AGENTSKILL_WEBSITE = 'http://14.103.216.135:31003/'

export function ModelManagementPanel(): ReactElement {
  const status = useAtomValue(authStatusAtom)
  const modelConfig = useAtomValue(modelConfigAtom)
  const usage = useAtomValue(modelUsageAtom)
  const setModelUsage = useSetAtom(modelUsageAtom)
  const recommendedModel = useAtomValue(recommendedModelIdAtom)
  const [config, setConfig] = useAtom(runworkConfigAtom)
  const setLoginModal = useSetAtom(loginModalAtom)
  const setChannels = useSetAtom(channelsAtom)
  const [refreshing, setRefreshing] = useState(false)

  /** 勾选后刷新渠道 atom，让 ModelSelector 实时感知变化 */
  const refreshChannels = (): void => {
    void window.electronAPI.listChannels().then(setChannels).catch(console.error)
  }

  // 从 modelConfig 提取模型列表和推荐模型
  const availableModels: ModelItem[] = modelConfig?.provider?.models ?? []
  const selectedModelIds = config.selectedModelIds
  const defaultModelId = config.defaultModelId

  // 首次加载：如果 runworkConfig 的勾选为空，从渠道的 model.enabled 初始化
  useEffect(() => {
    if (selectedModelIds.length === 0 && availableModels.length > 0) {
      // 读渠道的 enabled 状态作为初始值
      void window.electronAPI.listChannels().then((channels) => {
        const official = channels.find((c) => c.id === 'runwork-official')
        if (official) {
          const enabledIds = official.models.filter((m) => m.enabled).map((m) => m.id)
          if (enabledIds.length > 0) {
            setConfig(updateSelectedModels(config, enabledIds))
          }
        }
      })
    }
  }, [availableModels.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // 定时刷新余额（每 5 分钟）
  useEffect(() => {
    if (status !== 'authenticated') return
    const interval = setInterval(async () => {
      const token = await getStoredToken()
      if (token) {
        const usage = await fetchModelUsage(token)
        if (usage) {
          setModelUsage(usage)
        }
      }
    }, 5 * 60 * 1000) // 5 分钟
    return () => clearInterval(interval)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // 未登录：提示登录
  if (status !== 'authenticated') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted-foreground mb-3">登录后即可管理模型</p>
        <button
          onClick={() => setLoginModal({ open: true, reason: '登录后即可管理模型', onSuccess: null })}
          className="text-sm text-primary hover:underline"
        >
          点击登录 →
        </button>
      </div>
    )
  }

  // model-config 未就绪（status 非 active）
  if (modelConfig && modelConfig.status !== 'active') {
    const statusText: Record<string, string> = {
      pending: '模型账号开通中，请稍候',
      failed: `模型账号开通失败${modelConfig.binding?.lastError ? `：${modelConfig.binding.lastError}` : ''}，请联系管理员`,
      missing: '模型账号尚未开通，请联系管理员',
    }
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {statusText[modelConfig.status] ?? '模型账号状态异常'}
        </p>
      </div>
    )
  }

  // 模型勾选切换（同时同步到渠道的 model.enabled）
  const toggleModel = (modelId: string): void => {
    const isSelected = selectedModelIds.includes(modelId)
    const newSelection = isSelected
      ? selectedModelIds.filter((id) => id !== modelId)
      : [...selectedModelIds, modelId]
    setConfig(updateSelectedModels(config, newSelection))
    // 同步到渠道磁盘（ModelSelector 读的是 channel.models[].enabled）
    void window.electronAPI.runworkChannel.updateModelSelection(newSelection).then(() => {
      refreshChannels()  // 刷新内存中的 channelsAtom，让 ModelSelector 实时感知
    })
  }

  // 全选/全不选
  const allSelected = availableModels.length > 0 && availableModels.every((m) => selectedModelIds.includes(m.id))
  const toggleAll = (): void => {
    const newSelection = allSelected ? [] : availableModels.map((m) => m.id)
    setConfig(updateSelectedModels(config, newSelection))
    void window.electronAPI.runworkChannel.updateModelSelection(newSelection).then(() => {
      refreshChannels()
    })
  }

  // 刷新余额
  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    const token = await getStoredToken()
    if (token) {
      const usage = await fetchModelUsage(token)
      if (usage) {
        setModelUsage(usage)
      }
    }
    setRefreshing(false)
  }

  return (
    <div className="space-y-6 pb-8">
      {/* 余额卡片 */}
      <div className="rounded-xl border border-border p-5 space-y-3 bg-card/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">余额</span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {usage && (
          <div className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              ${usage.balanceUsd.toFixed(2)}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>已用 ${usage.usedUsd.toFixed(2)}</span>
              <button
                onClick={() => window.open(AGENTSKILL_WEBSITE, '_blank')}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink size={11} />
                购买余量
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 可用模型 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">可用模型</span>
          <button
            onClick={toggleAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {allSelected ? '全不选' : '全选'}
          </button>
        </div>

        <div className="space-y-1.5 rounded-xl border border-border overflow-hidden">
          {availableModels.map((model) => {
            const isSelected = selectedModelIds.includes(model.id)
            const isRecommended = model.id === modelConfig?.provider?.selectedModel
            return (
              <label
                key={model.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleModel(model.id)}
                  className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border'
                  }`}
                >
                  {isSelected && <Check size={12} />}
                </button>
                <span className="text-sm text-foreground flex-1">{model.name}</span>
                {isRecommended && (
                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    推荐
                  </span>
                )}
              </label>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          已选 {selectedModelIds.length} 个模型（对话中只显示勾选的模型）
        </p>
      </div>

      {/* 默认模型 */}
      {selectedModelIds.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">默认模型</label>
          <select
            value={defaultModelId}
            onChange={(e) => setConfig(updateDefaultModel(config, e.target.value))}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">选择默认模型</option>
            {availableModels
              .filter((m) => selectedModelIds.includes(m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
          <p className="text-xs text-muted-foreground">对话时的初始选中模型</p>
        </div>
      )}
    </div>
  )
}
