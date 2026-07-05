/**
 * AccountInfoCard — 账号信息卡片
 *
 * 插在通用设置页顶部，展示账号信息 + 修改密码 + 退出登录。
 * 未登录时显示"请先登录"提示。
 */

import { useState, type ReactElement } from 'react'
import { useAtomValue, useSetAtom, useStore } from 'jotai'
import { User, Mail, Building2, LogOut } from 'lucide-react'
import {
  authStatusAtom,
  authUserAtom,
  loginModalAtom,
  changePasswordModalAtom,
  clearStoredToken,
} from '../auth/auth-state'
import { clearSK } from '../model/model-config'

export function AccountInfoCard(): ReactElement {
  const status = useAtomValue(authStatusAtom)
  const user = useAtomValue(authUserAtom)
  const setLoginModal = useSetAtom(loginModalAtom)
  const store = useStore()

  const [showChangePassword, setShowChangePassword] = useState(false)

  // 未登录：显示登录引导
  if (status !== 'authenticated' || !user) {
    return (
      <div className="rounded-xl border border-border p-5 space-y-3 bg-card/50">
        <div className="flex items-center gap-2">
          <User size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">账号</span>
        </div>
        <p className="text-sm text-muted-foreground">未登录</p>
        <button
          onClick={() => setLoginModal({ open: true, reason: '登录以使用完整功能', onSuccess: null })}
          className="text-sm text-primary hover:underline"
        >
          点击登录 →
        </button>
      </div>
    )
  }

  const handleLogout = async (): Promise<void> => {
    await clearStoredToken()
    await clearSK()
    // 重置 atoms（通过 store 直接设置）
    store.set(authStatusAtom, 'guest')
    store.set(authUserAtom, null)
  }

  return (
    <div className="rounded-xl border border-border p-5 space-y-4 bg-card/50">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <User size={16} className="text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">账号</span>
      </div>

      {/* 用户信息 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">{user.fullName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail size={12} />
          <span>{user.email}</span>
        </div>
        {user.companyName && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 size={12} />
            <span>
              {user.companyName}
              {user.teamName ? ` · ${user.teamName}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2 border-t border-border/50">
        <button
          onClick={() => setShowChangePassword(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted"
        >
          修改密码
        </button>
        <button
          onClick={handleLogout}
          className="text-xs text-destructive hover:text-destructive/80 transition-colors px-3 py-1.5 rounded-md hover:bg-destructive/5 flex items-center gap-1"
        >
          <LogOut size={12} />
          退出登录
        </button>
      </div>

      {/* TODO: 改密弹窗组件（MVP 暂用 confirm，后续替换为 ChangePasswordDialog） */}
      {showChangePassword && (
        <div className="text-xs text-muted-foreground">
          改密功能开发中，请通过管理员后台修改密码。
        </div>
      )}
    </div>
  )
}
