/**
 * LoginModal — 全局登录弹窗
 *
 * 使用 Radix Dialog（自带 Portal），渲染到 document.body，
 * 不受祖先 CSS（transform/filter）的定位和宽度干扰。
 *
 * 由 useRequireAuth 触发（未登录做权限操作时），
 * 或由 Token 过期自动触发（401 时）。
 */

import { useEffect, useState, type ReactElement } from 'react'
import { useAtom, useSetAtom, useStore } from 'jotai'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  loginModalAtom,
  authStatusAtom,
  authUserAtom,
  changePasswordModalAtom,
  setStoredToken,
} from './auth-state'
import { login } from './auth-api'
import { ChangePasswordDialog } from '../account/ChangePasswordDialog'
import { fetchModelConfigData, modelConfigAtom, recommendedModelIdAtom } from '../model/model-config'
import { fetchModelUsage, modelUsageAtom } from '../model/model-usage'
import { syncModelConfigToChannels } from '../model/channel-sync'

export function LoginModal(): ReactElement {
  const store = useStore()
  const [modal, setModal] = useAtom(loginModalAtom)
  const [changePasswordModal, setChangePasswordModal] = useAtom(changePasswordModalAtom)
  const setStatus = useSetAtom(authStatusAtom)
  const setUser = useSetAtom(authUserAtom)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 弹窗打开时清空表单
  useEffect(() => {
    if (modal.open) {
      setEmail('')
      setPassword('')
      setError('')
      setLoading(false)
    }
  }, [modal.open])

  const handleLogin = async (): Promise<void> => {
    if (!email.trim() || !password.trim()) {
      setError('请输入邮箱和密码')
      return
    }

    setLoading(true)
    setError('')

    const result = await login(email.trim(), password)

    if (result.success && result.token && result.user) {
      // Token 存 Keychain
      await setStoredToken(result.token)

      // 更新状态
      setStatus('authenticated')
      setUser(result.user)

      // 拉取 model-config + model-usage
      const modelConfig = await fetchModelConfigData(result.token)
      if (modelConfig) {
        store.set(modelConfigAtom, modelConfig)
        // 设置推荐模型 ID（供 ModelManagementPanel 显示"推荐"标签）
        if (modelConfig.provider?.selectedModel) {
          store.set(recommendedModelIdAtom, modelConfig.provider.selectedModel)
        }
        await syncModelConfigToChannels(modelConfig)
      }

      const usage = await fetchModelUsage(result.token)
      if (usage) {
        store.set(modelUsageAtom, usage)
      }

      // 关闭登录弹窗
      const onSuccess = modal.onSuccess
      setModal({ open: false, reason: '', onSuccess: null })

      // 如果需要强制改密
      if (result.user.mustChangePassword) {
        store.set(changePasswordModalAtom, { open: true, reason: '首次登录请修改密码' })
      }

      // 执行回调（如发送消息）
      if (onSuccess) {
        onSuccess()
      }
    } else {
      setError(result.error || '登录失败')
      setPassword('')
    }

    setLoading(false)
  }

  const handleOpenChange = (open: boolean): void => {
    if (!open && !loading) {
      setModal({ open: false, reason: '', onSuccess: null })
    }
  }

  return (
    <>
    <Dialog open={modal.open} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-none w-[340px] p-6 gap-4" aria-describedby={undefined}>
        {/* 标题 */}
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">{modal.reason}</DialogTitle>
          <p className="text-xs text-muted-foreground">Legis</p>
        </DialogHeader>

        {/* 错误提示 */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg px-3 py-1.5">
            {error}
          </div>
        )}

        {/* 邮箱 */}
        <div className="space-y-1">
          <label htmlFor="legis-login-email" className="text-xs font-medium text-foreground/60">
            邮箱
          </label>
          <input
            id="legis-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="请输入邮箱"
            autoComplete="email"
            autoFocus
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLogin()
            }}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
        </div>

        {/* 密码 */}
        <div className="space-y-1">
          <label htmlFor="legis-login-password" className="text-xs font-medium text-foreground/60">
            密码
          </label>
          <div className="relative">
            <input
              id="legis-login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin()
              }}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-foreground/30 hover:text-foreground/60 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
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
            onClick={handleLogin}
            disabled={loading}
            className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>
                <LogIn size={14} />
                登录
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>

    {/* 强制改密弹窗（mustChangePassword=true 时触发） */}
    <ChangePasswordDialog
      open={changePasswordModal.open}
      onClose={() => setChangePasswordModal({ open: false, reason: '' })}
    />
    </>
  )
}
