/**
 * useRequireAuth — 权限触发器 hook
 *
 * 在需要登录才能执行的操作（发送消息、调模型、模型管理）处调用。
 * 已登录直接执行，未登录弹出登录窗，登录成功后继续执行。
 *
 * 用法：
 *   const requireAuth = useRequireAuth()
 *   requireAuth('发送消息', () => sendMessage(text))
 */

import { useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { authStatusAtom, loginModalAtom } from './auth-state'

export function useRequireAuth() {
  const status = useAtomValue(authStatusAtom)
  const setLoginModal = useSetAtom(loginModalAtom)

  return useCallback(
    (action: string, fn: () => void): void => {
      if (status === 'authenticated') {
        fn()
      } else {
        // 未登录：弹出登录窗，登录成功后执行 fn
        setLoginModal({
          open: true,
          reason: `登录后即可${action}`,
          onSuccess: fn,
        })
      }
    },
    [status, setLoginModal],
  )
}
