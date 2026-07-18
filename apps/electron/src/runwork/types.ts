/**
 * RunWork 认证与模型集成的类型定义
 *
 * 对齐 docs/desktop-integration-guide.zh.md 的服务端接口契约。
 * 类型字段基于 2026-07-04 真实接口验证（非纯文档推断）。
 */

/** 认证状态 */
export type AuthStatus = 'loading' | 'authenticated' | 'guest'

// ---- 用户信息 ----

/**
 * 用户信息（POST /auth/login 和 GET /auth/me 返回）
 *
 * 桌面端用户固定 isAdmin: false。
 * mustChangePassword 为 true 时，所有业务接口会返回 password_change_required。
 */
export interface RunWorkUser {
  id: number
  email: string
  fullName: string
  isAdmin: boolean
  companyId?: number
  companyName?: string
  teamId?: number
  teamName?: string
  status: 'active' | 'disabled'
  mustChangePassword: boolean
  passwordChangedAt?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt?: string
}

// ---- 模型配置 ----

/** 模型项（provider.models 数组元素） */
export interface ModelItem {
  id: string
  name: string
  /** 排序权重（文档提到，实际接口未返回，设为可选） */
  sortOrder?: number
}

/** AgentSkill 供应商信息（provider 字段） */
export interface ModelProvider {
  id: string
  name: string
  /** AgentSkill 调模型入口，拼接成 `${baseUrl}/v1/messages` */
  baseUrl: string
  /** API 协议格式，当前固定 'anthropic'（Anthropic Messages API 兼容） */
  format: string
  /** 用户的明文 SK（仅存内存，绝不写磁盘/日志） */
  apiKey: string
  /** 默认推荐模型 ID */
  selectedModel: string
  /** 可选模型列表 */
  models: ModelItem[]
}

/** SK 与余额绑定信息（binding 字段） */
export interface ModelBinding {
  status: string
  apiKeyMasked?: string
  quota?: number
  quotaUsed?: number
  quotaRemaining?: number
  quotaUsd?: number
  balanceUsd?: number
  usedUsd?: number
  currency?: string
  groupKey?: string
  groupName?: string
  subgroupKey?: string
  subgroupName?: string
  channel?: string
  externalUserId?: string
  autoRechargeEnabled?: boolean
  autoRechargeThresholdUsd?: number
  autoRechargeAmountUsd?: number
  lastError?: string | null
  updatedAt?: string
}

/** 模型配置（GET /auth/me/model-config 返回） */
export interface ModelConfig {
  /** 模型账号绑定状态，非 active 不能调模型 */
  status: 'active' | 'pending' | 'failed' | 'missing'
  provider: ModelProvider | null
  binding: ModelBinding
}

// ---- 模型用量 ----

/** 用量与余额（GET /auth/me/model-usage 返回） */
export interface ModelUsage {
  status: string
  quota?: number
  quotaUsed?: number
  quotaRemaining?: number
  /** 美元口径配额总额 */
  quotaUsd: number
  /** 美元口径已用 */
  usedUsd: number
  /** 美元口径余额 */
  balanceUsd: number
  currency: string
  apiKeyMasked: string
  updatedAt: string
}

// ---- 登录弹窗 ----

/** 登录弹窗状态（由 useRequireAuth 触发） */
export interface LoginModalState {
  open: boolean
  /** 弹窗标题文案，随触发来源变化（如"登录后即可发送消息"） */
  reason: string
  /** 登录成功后要继续执行的回调（如发送消息），无则为 null */
  onSuccess: (() => void) | null
}

// ---- API 响应 ----

/** 登录成功响应 */
export interface LoginResponse {
  success: boolean
  data?: {
    token: string
    user: RunWorkUser
  }
  error?: string
  code?: string
}

/** /auth/me 响应 */
export interface MeResponse {
  success: boolean
  data?: RunWorkUser
  error?: string
  code?: string
}

/** /auth/me/model-config 响应 */
export interface ModelConfigResponse {
  success: boolean
  data?: ModelConfig
  error?: string
  code?: string
}

/** /auth/me/model-usage 响应 */
export interface ModelUsageResponse {
  success: boolean
  data?: ModelUsage
  error?: string
  code?: string
}

/** 改密响应 */
export interface ChangePasswordResponse {
  success: boolean
  data?: { ok: boolean }
  error?: string
  code?: string
}

// ---- RunWork 配置 ----

/** ~/.runwork-dev/runwork-config.json 的结构（用户偏好，运行时可变） */
export interface RunWorkConfig {
  /** 用户勾选的模型 ID 列表（对话中只显示这些） */
  selectedModelIds: string[]
  /** 默认模型 ID（对话时的初始选中） */
  defaultModelId: string
}
