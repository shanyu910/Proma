/**
 * LoginScreen - 远端认证登录界面
 *
 * 对接 Legis-Server /auth/login。
 * 服务器地址从 authServerUrlAtom 读取（由 App 初始化时从主进程 settings 注入）。
 * 使用项目全局 CSS 变量，自动适配浅色/深色主题。
 */

import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import {
  isLoggedInAtom,
  authTokenAtom,
  authUserAtom,
  authServerUrlAtom,
  loginErrorAtom,
  login,
  type RemoteUser,
} from '@/atoms/auth'

export function LoginScreen(): React.ReactElement {
  const serverUrl = useAtomValue(authServerUrlAtom)
  const [, setLoggedIn] = useAtom(isLoggedInAtom)
  const [, setToken] = useAtom(authTokenAtom)
  const [, setUser] = useAtom(authUserAtom)
  const [error, setError] = useAtom(loginErrorAtom)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!email.trim() || !password.trim()) {
      setError('请输入邮箱和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const ok = await login(serverUrl, email.trim(), password)
      if (ok) {
        // 重新读取 token（login 内部已 cacheToken），并触发后续 checkSession 拉取用户信息
        // 这里用 serverUrl 再查一次 /auth/me 拿用户信息
        const res = await fetch(`${serverUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('legis-auth-token') || ''}`,
          },
        })
        const json: { success: boolean; data?: RemoteUser } = await res.json()
        if (json.success && json.data) {
          setToken(localStorage.getItem('legis-auth-token'))
          setUser(json.data)
          setLoggedIn(true)
        } else {
          setError('登录成功但获取用户信息失败')
        }
      } else {
        setError('账号或密码错误')
        setPassword('')
      }
    } catch {
      setError('无法连接认证服务器，请检查网络')
    }

    setLoading(false)
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-[380px] mx-4">
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6"
        >
          {/* 标题 */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Legis</h1>
            <p className="text-sm text-muted-foreground">登录以继续使用</p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[13px] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* 邮箱 */}
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-[13px] font-medium text-foreground/70">
              邮箱
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              autoComplete="email"
              autoFocus
              disabled={loading}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
          </div>

          {/* 密码 */}
          <div className="space-y-2">
            <label htmlFor="login-password" className="text-[13px] font-medium text-foreground/70">
              密码
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={loading}
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

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          >
            {loading ? (
              <span className="spinner">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className="spinner-cube" />
                ))}
              </span>
            ) : (
              <>
                <LogIn size={16} />
                登 录
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
