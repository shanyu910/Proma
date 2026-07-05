/**
 * ChangePasswordDialog — 修改密码弹窗
 *
 * 使用 Radix Dialog（自带 Portal），渲染到 document.body，
 * 不受 LeftSidebar 祖先 CSS（transform/filter）的定位干扰。
 */

import { useState, type ReactElement } from 'react'
import { useStore } from 'jotai'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { authUserAtom, getStoredToken } from '../auth/auth-state'
import { changePassword } from '../auth/auth-api'

export function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): ReactElement {
  const store = useStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    setError('')

    if (!currentPassword.trim()) {
      setError('请输入当前密码')
      return
    }
    if (newPassword.length < 8) {
      setError('新密码至少需要 8 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    if (newPassword === currentPassword) {
      setError('新密码不能与当前密码相同')
      return
    }

    setLoading(true)
    const token = await getStoredToken()
    if (!token) {
      setError('登录已失效，请重新登录')
      setLoading(false)
      return
    }

    const result = await changePassword(token, currentPassword, newPassword)

    if (result.success) {
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      // 2 秒后自动关闭
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2000)
    } else {
      setError(result.error || '修改密码失败')
    }
    setLoading(false)
  }

  const handleOpenChange = (next: boolean): void => {
    if (loading) return
    if (!next) {
      // 关闭时重置表单
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError('')
      setSuccess(false)
    }
    if (!next) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-none w-[280px] p-5 gap-3" aria-describedby={undefined}>
        {success ? (
          <div className="text-center py-4">
            <div className="text-xl mb-1">✓</div>
            <p className="text-sm text-foreground">密码修改成功</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-foreground">修改密码</DialogTitle>
            </DialogHeader>

            {/* 错误提示 */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg px-3 py-1.5">
                {error}
              </div>
            )}

            {/* 当前密码 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground/60">当前密码</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="请输入当前密码"
                autoComplete="current-password"
                autoFocus
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                }}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </div>

            {/* 新密码 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground/60">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 8 位"
                autoComplete="new-password"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                }}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </div>

            {/* 确认新密码 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground/60">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                autoComplete="new-password"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                }}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </div>

            {/* 按钮 */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
                className="flex-1 h-9 rounded-lg border border-border text-foreground/70 text-sm transition-colors hover:bg-muted disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  '确认'
                )}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
