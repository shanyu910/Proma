/**
 * SkillMarketDialog — Skill 市场弹窗
 *
 * 点击 Agent 技能页的"社区市场"按钮打开。
 * 展示所有市场 Skill，支持搜索、安装。
 * 安装完成后自动刷新当前工作区的 Skill 列表。
 */

import * as React from 'react'
import { toast } from 'sonner'
import { Store, Search, RefreshCw, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { MarketSkill } from './types'
import { SkillMarketCard } from './SkillMarketCard'

interface SkillMarketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 当前工作区 slug（安装目标） */
  workspaceSlug: string
  /** 已安装的 Skill slug 集合（用于显示"已安装"状态） */
  installedSlugs: Set<string>
  /** 安装成功后回调（让父组件刷新 Skill 列表） */
  onInstalled: () => void
}

type LoadState = 'loading' | 'success' | 'error'

export function SkillMarketDialog({
  open,
  onOpenChange,
  workspaceSlug,
  installedSlugs,
  onInstalled,
}: SkillMarketDialogProps): React.ReactElement {
  const [skills, setSkills] = React.useState<MarketSkill[]>([])
  const [loadState, setLoadState] = React.useState<LoadState>('loading')
  const [search, setSearch] = React.useState('')
  const [installingSlug, setInstallingSlug] = React.useState<string | null>(null)
  // 记录本次会话中安装成功的 slug（立即显示"已安装"，无需等父组件刷新）
  const [sessionInstalled, setSessionInstalled] = React.useState<Set<string>>(new Set())

  /** 拉取市场列表 */
  const loadSkills = React.useCallback(async (): Promise<void> => {
    setLoadState('loading')
    try {
      const list = await window.electronAPI.skillMarket.list()
      setSkills(list)
      setLoadState('success')
    } catch (error) {
      console.error('[Skill 市场] 拉取失败:', error)
      setLoadState('error')
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      loadSkills()
      setSearch('')
    }
  }, [open, loadSkills])

  /** 安装某个 Skill */
  const handleInstall = async (skill: MarketSkill): Promise<void> => {
    if (!workspaceSlug || installingSlug) return
    setInstallingSlug(skill.skillId)
    try {
      const result = await window.electronAPI.skillMarket.install(skill.skillId, workspaceSlug)
      setSessionInstalled((prev) => new Set(prev).add(skill.skillId))
      toast.success(`已安装 Skill：${result.name}`)
      onInstalled()
    } catch (error) {
      console.error('[Skill 市场] 安装失败:', error)
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('安装失败', { description: message })
    } finally {
      setInstallingSlug(null)
    }
  }

  /** 搜索过滤 */
  const q = search.trim().toLowerCase()
  const filteredSkills = q
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.skillId.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      )
    : skills

  /** 计算安装状态 */
  const getInstallStatus = (skill: MarketSkill): 'idle' | 'installing' | 'installed' => {
    if (installingSlug === skill.skillId) return 'installing'
    if (sessionInstalled.has(skill.skillId) || installedSlugs.has(skill.skillId)) return 'installed'
    return 'idle'
  }

  const installedCount = skills.filter((s) => getInstallStatus(s) === 'installed').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col gap-4 max-h-[82vh] overflow-hidden"
        style={{ width: 'min(960px, 90vw)', maxWidth: '90vw' }}
      >
        {/* 头部 */}
        <div className="flex items-center gap-2.5 px-6 pt-7 pb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
            <Store size={16} />
          </div>
          <DialogTitle className="text-lg">Skill 市场</DialogTitle>
        </div>

        {/* 搜索栏 */}
        <div className="px-6">
          <div className="flex items-center gap-2 h-9 rounded-lg border border-border/60 bg-muted/50 px-3 focus-within:border-primary/40 transition-colors">
            <Search size={15} className="shrink-0 text-muted-foreground/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 Skill..."
              className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground/35 focus:outline-none"
            />
          </div>
        </div>

        {/* 卡片网格 */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
          {loadState === 'loading' ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          ) : loadState === 'error' ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <span className="text-sm">加载失败，请检查网络或重新登录</span>
              <button
                onClick={() => void loadSkills()}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted/50 transition-colors"
              >
                <RefreshCw size={13} />
                重试
              </button>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <span className="text-sm">
                {q ? `没有匹配「${search}」的 Skill` : '市场暂无 Skill'}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filteredSkills.map((skill) => (
                <SkillMarketCard
                  key={skill.skillId}
                  skill={skill}
                  status={getInstallStatus(skill)}
                  onInstall={() => void handleInstall(skill)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-border/30">
          <span className="text-xs text-muted-foreground">
            {loadState === 'success' && `共 ${skills.length} 个 Skill · 已安装 ${installedCount} 个`}
          </span>
          <button
            onClick={() => void loadSkills()}
            disabled={loadState === 'loading'}
            className={cn(
              'flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors',
              loadState === 'loading' && 'opacity-50',
            )}
          >
            <RefreshCw size={13} className={cn(loadState === 'loading' && 'animate-spin')} />
            刷新
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
