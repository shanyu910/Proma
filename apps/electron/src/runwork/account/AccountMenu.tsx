/**
 * AccountMenu — 账号弹出菜单
 *
 * 挂在侧边栏底部的用户头像按钮上，点击弹出（往上弹）。
 * 展示：姓名 + 邮箱 + 公司/团队 + 修改密码 + 退出登录。
 */

import { useState, type ReactElement } from 'react'
import { useAtomValue, useStore } from 'jotai'
import { Mail, Building2, LogOut, KeyRound, ChevronDown } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  authStatusAtom,
  authUserAtom,
  clearStoredToken,
} from '../auth/auth-state'
import { clearSK } from '../model/model-config'
import { ChangePasswordDialog } from './ChangePasswordDialog'

export function AccountMenu(): ReactElement {
  const user = useAtomValue(authUserAtom)
  const store = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const handleLogout = async (): Promise<void> => {
    setMenuOpen(false)
    await clearStoredToken()
    await clearSK()
    store.set(authStatusAtom, 'guest')
    store.set(authUserAtom, null)
  }

  const handleChangePassword = (): void => {
    setMenuOpen(false)
    setPasswordOpen(true)
  }

  if (!user) return <></>

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button className="w-full flex items-center gap-2 rounded-[10px] px-3 py-2 text-foreground/70 transition-colors hover:bg-foreground/[0.04] hover:text-foreground">
            <span className="flex-1 text-left min-w-0">
              <span className="block text-sm truncate">{user.fullName}</span>
              <span className="block text-[11px] text-muted-foreground truncate">{user.email}</span>
            </span>
            <ChevronDown size={14} className={`flex-shrink-0 text-foreground/40 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-64 p-0"
        >
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
              onClick={handleChangePassword}
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
        </PopoverContent>
      </Popover>

      {/* 改密弹窗 */}
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  )
}
