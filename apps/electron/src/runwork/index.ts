/**
 * RunWork 认证与模型集成模块 — 对外统一出口
 *
 * 原项目代码只 import 这里的东西。
 */

// 认证关卡 + 登录弹窗
export { AuthInitializer } from './auth/AuthInitializer'
export { LoginModal } from './auth/LoginModal'
export { useRequireAuth } from './auth/useRequireAuth'
export { useAuthGate } from './auth/useAuthGate'

// 认证状态 atoms（供设置页/账号卡片使用）
export {
  authStatusAtom,
  authUserAtom,
  clearStoredToken,
  getStoredToken,
} from './auth/auth-state'
export { changePassword, updateProfile } from './auth/auth-api'

// 账号弹出菜单（供侧边栏使用）
export { AccountMenu } from './account/AccountMenu'

// 模型配置 + 余额（供设置页使用）
export {
  modelConfigAtom,
  recommendedModelIdAtom,
  clearSK,
  refreshSK,
  fetchModelConfigData,
} from './model/model-config'
export { modelUsageAtom, fetchModelUsage } from './model/model-usage'

// 渠道同步
export { OFFICIAL_CHANNEL_ID } from './model/channel-sync'

// 用户配置
export { runworkConfigAtom, loadRunWorkConfig, updateSelectedModels, updateDefaultModel } from './config/runwork-config'

// 类型（供外部使用）
export type {
  AuthStatus,
  RunWorkUser,
  ModelConfig,
  ModelItem,
  ModelUsage,
} from './types'
