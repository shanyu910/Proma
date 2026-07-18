/**
 * useAuthGate — 全局认证门控 hook
 *
 * 提供认证状态判断 + 权限触发器，供各 UI 组件统一使用。
 * 未登录时 UI 降级为"只读浏览模式"。
 *
 * 用法：
 *   const { isAuthenticated, isGuest, requireAuth } = useAuthGate()
 *
 *   // 渲染时判断
 *   if (isGuest) return <禁用态 />
 *
 *   // 操作时拦截
 *   requireAuth('发送消息', () => sendMessage(text))
 */

import { useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { authStatusAtom, loginModalAtom } from './auth-state'

export function useAuthGate() {
  const status = useAtomValue(authStatusAtom)
  const setLoginModal = useSetAtom(loginModalAtom)

  const isAuthenticated = status === 'authenticated'
  const isGuest = status === 'guest'
  const isLoading = status === 'loading'

  const requireAuth = useCallback(
    (action: string, fn: () => void): void => {
      if (isAuthenticated) {
        fn()
      } else {
        setLoginModal({
          open: true,
          reason: `登录后即可${action}`,
          onSuccess: fn,
        })
      }
    },
    [isAuthenticated, setLoginModal],
  )

  return {
    isAuthenticated,
    isGuest,
    isLoading,
    /** @deprecated 用 requireAuth 代替，保留向后兼容 */
    requireAuth,
  }
}
