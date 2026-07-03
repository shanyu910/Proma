import * as React from 'react'
import { useAtom, useStore } from 'jotai'
import { AppShell } from './components/app-shell/AppShell'
import { OnboardingView } from './components/onboarding/OnboardingView'
import { TutorialBanner } from './components/tutorial/TutorialBanner'
import { EnvironmentCheckDialog } from './components/environment/EnvironmentCheckDialog'
import { MigrationImportDialog } from './components/migration/MigrationImportDialog'
import { TooltipProvider } from './components/ui/tooltip'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { LoginScreen } from './components/auth/LoginScreen'
import { conversationsAtom } from './atoms/chat-atoms'
import { environmentCheckDialogOpenAtom } from './atoms/environment'
import { tabsAtom, activeTabIdAtom, openTab, TUTORIAL_TAB_ID } from './atoms/tab-atoms'
import type { AppShellContextType } from './contexts/AppShellContext'
import {
  isLoggedInAtom,
  isCheckingAtom,
  authTokenAtom,
  authUserAtom,
  authServerUrlAtom,
  checkSession,
  logout,
} from './atoms/auth'

/**
 * 认证关卡 hook
 *
 * 启动时：
 * 1. 从主进程 settings 读取 authServerUrl，注入到 authServerUrlAtom
 * 2. 如果有缓存的 token，向服务器验证是否仍然有效
 * 3. 返回当前是否已通过认证（isChecking=true 时返回 false 以阻塞渲染）
 */
function useAuthGate(): boolean {
  const setAuthServerUrl = useAtom(authServerUrlAtom)[1]
  const [isLoggedIn, setLoggedIn] = useAtom(isLoggedInAtom)
  const [isChecking, setChecking] = useAtom(isCheckingAtom)
  const [token, setToken] = useAtom(authTokenAtom)
  const [, setUser] = useAtom(authUserAtom)

  React.useEffect(() => {
    let cancelled = false

    const init = async () => {
      // 1. 从主进程 settings 注入认证服务器地址
      let serverUrl = ''
      try {
        const settings = await window.electronAPI.getSettings()
        serverUrl = settings.authServerUrl || ''
        if (!cancelled) setAuthServerUrl(serverUrl)
      } catch {
        console.error('[Auth] 读取 authServerUrl 失败')
      }

      // 2. 没有 token，直接显示登录页
      if (!isLoggedIn || !token) {
        if (!cancelled) setChecking(false)
        return
      }

      // 3. 有 token，向服务器验证有效性
      const result = await checkSession(serverUrl)
      if (cancelled) return

      if (result.valid && result.user) {
        setUser(result.user)
        setLoggedIn(true)
      } else {
        // token 过期 / 无效
        setToken(null)
        setUser(null)
        setLoggedIn(false)
        logout()
      }
      setChecking(false)
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isChecking) return false // 还在验证中，阻塞渲染
  return isLoggedIn
}

export default function App(): React.ReactElement {
  // [FLASH-DEBUG] 监控 App 组件重渲染（如果看到频繁日志，说明根组件被频繁重渲染）
  const appRenderCountRef = React.useRef(0)
  appRenderCountRef.current++
  if (appRenderCountRef.current > 1) {
    console.warn(`[FLASH-DEBUG] App re-render #${appRenderCountRef.current}, isLoading/showOnboarding may have changed`)
  }

  const store = useStore()
  const [isLoading, setIsLoading] = React.useState(true)
  const [showOnboarding, setShowOnboarding] = React.useState(false)

  // 认证关卡：启动时验证 token，决定是否显示登录页
  const isLoggedIn = useAuthGate()
  const [isChecking] = useAtom(isCheckingAtom)

  // 初始化：检查是否需要显示 Onboarding（仅在已登录时执行）
  // 注意：useEffect 必须在所有条件 return 之前调用，否则违反 Hooks 规则。
  // macOS/Linux 上 SDK 自带 claude native binary 不依赖宿主 Node/Git；
  // Windows 上仍需 Git Bash/WSL，由 Onboarding Step 2 与聊天错误卡片引导用户安装。
  React.useEffect(() => {
    // 未登录或正在验证时，跳过 onboarding 初始化
    if (!isLoggedIn) {
      setIsLoading(false)
      return
    }

    const initialize = async () => {
      try {
        const settings = await window.electronAPI.getSettings()
        if (!settings.onboardingCompleted) {
          setShowOnboarding(true)
        }
      } catch (error) {
        console.error('[App] 初始化失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initialize()
  }, [isLoggedIn])

  // 正在验证 token → 空白占位（瞬间闪过，避免闪出登录页）
  if (isChecking) {
    return <div className="h-screen w-screen bg-background" />
  }

  // 未登录 → 显示登录页
  if (!isLoggedIn) {
    return (
      <TooltipProvider delayDuration={200}>
        <LoginScreen />
      </TooltipProvider>
    )
  }

  // 完成 onboarding 回调：创建欢迎对话，可选打开教程 Tab
  const handleOnboardingComplete = async (openTutorial?: boolean) => {
    setShowOnboarding(false)

    if (openTutorial) {
      const tabs = store.get(tabsAtom)
      const result = openTab(tabs, { type: 'tutorial', sessionId: TUTORIAL_TAB_ID, title: 'Legis 使用教程' })
      store.set(tabsAtom, result.tabs)
      store.set(activeTabIdAtom, result.activeTabId)
      return
    }

    try {
      const meta = await window.electronAPI.createWelcomeConversation()
      if (meta) {
        const conversations = store.get(conversationsAtom)
        store.set(conversationsAtom, [meta, ...conversations])

        const tabs = store.get(tabsAtom)
        const result = openTab(tabs, {
          type: 'chat',
          sessionId: meta.id,
          title: meta.title,
        })
        store.set(tabsAtom, result.tabs)
        store.set(activeTabIdAtom, result.activeTabId)
      }
    } catch (error) {
      console.error('[App] 创建欢迎对话失败:', error)
    }
  }

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">正在初始化...</p>
        </div>
      </div>
    )
  }

  // 显示 onboarding 界面
  if (showOnboarding) {
    return (
      <TooltipProvider delayDuration={200}>
        <OnboardingView onComplete={handleOnboardingComplete} />
        <MigrationImportDialog />
      </TooltipProvider>
    )
  }

  // Placeholder context value
  const contextValue: AppShellContextType = {}

  // 显示主界面
  return (
    <TooltipProvider delayDuration={200}>
      <AppShell contextValue={contextValue} />
      <SettingsDialog />
      <TutorialBanner />
      <GlobalEnvironmentCheckDialog />
      <MigrationImportDialog />
    </TooltipProvider>
  )
}

/**
 * 全局环境检测 Dialog，由错误卡片的 recovery action 按钮打开。
 */
function GlobalEnvironmentCheckDialog(): React.ReactElement {
  const [open, setOpen] = useAtom(environmentCheckDialogOpenAtom)
  return <EnvironmentCheckDialog open={open} onOpenChange={setOpen} />
}
