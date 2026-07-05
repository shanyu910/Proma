/**
 * LoginModal — 全局登录弹窗
 *
 * 由 useRequireAuth 触发（未登录做权限操作时），
 * 或由 Token 过期自动触发（401 时）。
 *
 * 登录成功后：
 * 1. Token 存 Keychain
 * 2. authStatus → authenticated
 * 3. 拉取 model-config + model-usage
 * 4. 执行 onSuccess 回调（如果有）
 * 5. 如果 mustChangePassword → 弹改密窗
 */

import { useEffect, useState, type ReactElement } from 'react'
import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import {
  loginModalAtom,
  authStatusAtom,
  authUserAtom,
  changePasswordModalAtom,
  setStoredToken,
} from './auth-state'
import { login } from './auth-api'
import { fetchModelConfigData, modelConfigAtom } from '../model/model-config'
import { fetchModelUsage, modelUsageAtom } from '../model/model-usage'
import { syncModelConfigToChannels } from '../model/channel-sync'

export function LoginModal(): ReactElement | null {
  const store = useStore()
  const [modal, setModal] = useAtom(loginModalAtom)
  const setStatus = useSetAtom(authStatusAtom)
  const setUser = useSetAtom(authUserAtom)
  const [changePasswordModal, setChangePasswordModal] = useAtom(changePasswordModalAtom)

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
        setChangePasswordModal({ open: true, reason: '首次登录请修改密码' })
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

  const handleClose = (): void => {
    setModal({ open: false, reason: '', onSuccess: null })
  }

  if (!modal.open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[340px] mx-4 bg-card border border-border rounded-2xl shadow-xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{modal.reason}</h2>
          <p className="text-xs text-muted-foreground">Legis</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[13px] rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* 邮箱 */}
        <div className="space-y-2">
          <label htmlFor="legis-login-email" className="text-[13px] font-medium text-foreground/70">
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
            className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
        </div>

        {/* 密码 */}
        <div className="space-y-2">
          <label htmlFor="legis-login-password" className="text-[13px] font-medium text-foreground/70">
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
              className="w-full h-10 rounded-lg border border-border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-foreground/30 hover:text-foreground/60 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 h-10 rounded-lg border border-border text-foreground/70 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>
                <LogIn size={16} />
                登录
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
