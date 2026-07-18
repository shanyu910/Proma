/**
 * SkillMarketCard — Skill 市场卡片
 *
 * 展示市场 Skill 的名称、版本、描述、来源、安装按钮。
 * 风格与 SkillCard 保持一致（圆角卡片、琥珀色图标、柔和边框）。
 */

import * as React from 'react'
import { Sparkles, ShieldCheck, Download, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketSkill } from './types'

/** Skill 安装状态 */
type InstallStatus = 'idle' | 'installing' | 'installed'

interface SkillMarketCardProps {
  skill: MarketSkill
  /** 当前安装状态 */
  status: InstallStatus
  /** 点击安装 */
  onInstall: () => void
}

export function SkillMarketCard({ skill, status, onInstall }: SkillMarketCardProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border/60 bg-content-area p-4 transition-all',
        status === 'installed' && 'opacity-60',
        status !== 'installing' && 'hover:border-border hover:shadow-sm',
      )}
    >
      {/* 头部：图标 + 名称 + 版本 */}
      <div className="flex items-start gap-2.5">
        <div className="rounded-xl bg-amber-500/12 p-2 text-amber-500 shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{skill.name}</span>
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              v{skill.version}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{skill.skillId}</div>
        </div>
      </div>

      {/* 描述 */}
      <p className="line-clamp-2 min-h-[36px] text-[13px] leading-5 text-muted-foreground">
        {skill.description || '暂无描述'}
      </p>

      {/* 底部：来源 + 安装按钮 */}
      <div className="mt-auto flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
          <ShieldCheck size={12} />
          RunWork 官方
        </span>

        {status === 'installed' ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check size={13} />
            已安装
          </span>
        ) : status === 'installing' ? (
          <button
            disabled
            className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground cursor-wait"
          >
            <Loader2 size={12} className="animate-spin" />
            安装中
          </button>
        ) : (
          <button
            onClick={onInstall}
            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download size={12} />
            安装
          </button>
        )}
      </div>
    </div>
  )
}
