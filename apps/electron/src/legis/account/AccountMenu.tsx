/**
 * AccountMenu — 账号弹出菜单
 *
 * 挂在侧边栏底部的用户头像按钮上，点击弹出。
 * 展示：头像 + 姓名 + 邮箱 + 公司/团队 + 修改密码 + 退出登录。
 *
 * 未登录时不渲染（由 LeftSidebar 控制）。
 */

import { useState, type ReactElement } from 'react'
import { useAtomValue, useSetAtom, useStore } from 'jotai'
import { Mail, Building2, LogOut, KeyRound, ChevronDown } from 'lucide-react'
import {
  authStatusAtom,
  authUserAtom,
  loginModalAtom,
  clearStoredToken,
} from '../auth/auth-state'
import { clearSK } from '../model/model-config'

export function AccountMenu(): ReactElement {
  const user = useAtomValue(authUserAtom)
  const store = useStore()
  const setLoginModal = useSetAtom(loginModalAtom)
  const [open, setOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const handleLogout = async (): Promise<void> => {
    setOpen(false)
    await clearStoredToken()
    await clearSK()
    store.set(authStatusAtom, 'guest')
    store.set(authUserAtom, null)
  }

  // 未登录：这个组件不会被渲染（LeftSidebar 控制）
  if (!user) return <></>

  return (
    <div className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 rounded-[10px] px-3 py-2 text-foreground/70 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
      >
        <span className="flex-1 text-left">
          <span className="block text-sm truncate">{user.fullName}</span>
          <span className="block text-[11px] text-muted-foreground truncate">{user.email}</span>
        </span>
        <ChevronDown size={14} className={`flex-shrink-0 text-foreground/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 弹出菜单 */}
      {open && (
        <>
          {/* 点击外部关闭 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
            {/* 用户信息 */}
            <div className="px-4 py-3 space-y-1.5 border-b border-border/50">
              <div className="text-sm font-medium text-foreground">{user.fullName}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail size={11} />
                <span className="truncate">{user.email}</span>
              </div>
              {user.companyName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 size={11} />
                  <span className="truncate">
                    {user.companyName}
                    {user.teamName ? ` · ${user.teamName}` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="py-1">
              <button
                onClick={() => {
                  setShowChangePassword(true)
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground/80 hover:bg-muted transition-colors"
              >
                <KeyRound size={14} />
                修改密码
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
              >
                <LogOut size={14} />
                退出登录
              </button>
            </div>
          </div>

          {/* TODO: 改密弹窗（MVP 暂用提示） */}
          {showChangePassword && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border border-border bg-popover shadow-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">改密功能开发中，请通过管理员后台修改密码。</p>
              <button
                onClick={() => setShowChangePassword(false)}
                className="text-xs text-primary hover:underline"
              >
                知道了
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
