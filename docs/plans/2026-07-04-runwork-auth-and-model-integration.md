# RunWork 认证与模型一体化集成方案

> 日期：2026-07-04
> 分支：`RunWork`
> 配套契约：`docs/desktop-integration-guide.zh.md`（服务端接口权威定义）

---

## 1. 背景与目标

### 1.1 当前问题

当前认证系统（`atoms/auth.ts` + `components/auth/LoginScreen.tsx`）存在多层问题：

- **硬关卡**：不登录无法进入应用，体验生硬
- **Token 存 localStorage**：违反服务端文档安全要求（应存 Keychain）
- **缺失 SK 流程**：没有 `/auth/me/model-config` 拉取，没有 SK 内存管理
- **渠道系统冗余**：用户手动配渠道，但实际只用 AgentSkill 一个
- **代码散落**：认证逻辑分散在 atoms/components/settings/main 多处

### 1.2 目标

根据 `docs/desktop-integration-guide.zh.md` 定义的服务端契约，重新设计完整的"身份—凭证—模型调用"链路：

```
登录（弹窗式，软关卡）
  → Token 存 Keychain（7 天有效）
  → /auth/me/model-config 拉取 SK + 模型列表（SK 仅内存）
  → 包装成官方渠道注入 channels.json
  → /auth/me/model-usage 拉取余额
  → 用户勾选模型子集，对话只显示勾选的
  → SK 401 时自动重拉 model-config
```

### 1.3 产品决策（已确认）

| 决策点 | 选择 | 理由 |
|---|---|---|
| 登录策略 | 软关卡 + 弹窗 | 用户可浏览历史，需要权限时弹登录 |
| 渠道系统 | 包装成官方渠道 | 改动最小，Chat/Agent 核心代码几乎不动 |
| 旧渠道处理 | 保留，只隐藏 UI 入口 | 防止数据丢失 |
| Token 存储 | Keychain（safeStorage） | 文档要求，最安全 |
| SK 存储 | 仅内存，不写磁盘 | 文档红线，防泄漏 |
| 退出登录 | 回到 guest 模式（不离开主界面） | 体验连贯 |
| Token 过期 | 弹登录窗提示"已过期" | 不整页切换 |
| 登录/账号位置 | 通用设置（非模型管理） | 职责分离 |
| 购买余量 | 跳转 AgentSkill 网站 | 文档约定 |
| 模型勾选 | 全选/全不选 + 推荐模型默认勾选 | 用户效率 |

---

## 2. 模块结构

所有 RunWork 自定义代码集中在 `apps/electron/src/runwork/`，原项目只做 5 处最小挂载。

```
apps/electron/src/
├── runwork/                           ← 所有 RunWork 代码（独立领地）
│   ├── index.ts                     ← 对外统一出口
│   │
│   ├── auth/                        ← 登录认证
│   │   ├── LoginModal.tsx           ← 弹窗式登录 UI
│   │   ├── AuthInitializer.tsx      ← 启动时静默验证 Token
│   │   ├── auth-state.ts            ← authStatus atom + loginModalAtom + Keychain
│   │   ├── auth-api.ts              ← /auth/login /auth/me /auth/change-password
│   │   ├── useRequireAuth.ts        ← requireAuth() 触发器 hook
│   │   └── ChangePasswordDialog.tsx ← 强制改密弹窗
│   │
│   ├── model/                       ← SK + 模型配置
│   │   ├── model-config.ts          ← /auth/me/model-config + SK 内存管理
│   │   ├── model-usage.ts           ← /auth/me/model-usage 余额
│   │   └── channel-sync.ts          ← model-config → channels.json 同步
│   │
│   ├── config/                      ← RunWork 配置管理
│   │   └── runwork-config.ts          ← ~/.runwork-dev/runwork-config.json 读写
│   │
│   ├── settings/                    ← 设置页 UI
│   │   └── ModelManagementPanel.tsx ← 替换 ChannelSettings
│   │
│   ├── account/                     ← 账号信息
│   │   └── AccountInfoCard.tsx      ← 账号 + 修改密码 + 退出登录
│   │
│   ├── secure/                      ← 主进程辅助
│   │   └── auth-secure-storage.ts   ← safeStorage Keychain 封装
│   │
│   └── types.ts                     ← User / ModelConfig / ModelUsage 类型
│
├── main/
│   ├── ipc.ts                       ← 【挂载点 2】+15行 Token 存储 IPC
│   └── lib/                         ← （runwork/secure/ 的代码被 ipc.ts import）
│
├── preload/
│   └── index.ts                     ← 【挂载点 2】+10行 暴露 authSecure API
│
└── renderer/
    ├── App.tsx                      ← 【挂载点 1】+3行 AuthInitializer + LoginModal
    ├── components/
    │   ├── chat/ChatInput.tsx       ← 【挂载点 5】包 requireAuth
    │   ├── agent/AgentInput.tsx     ← 【挂载点 5】包 requireAuth
    │   └── settings/
    │       ├── SettingsPanel.tsx    ← 【挂载点 3】tab 引用改为 ModelManagementPanel
    │       └── GeneralSettings.tsx  ← 【挂载点 4】+2行 AccountInfoCard
    └── atoms/
        └── （无改动）
```

**额外文件**（非 runwork/ 目录内）：
- `apps/electron/.env` — 环境变量（VITE_RUNWORK_SERVER_URL，不提交 git）
- `apps/electron/.env.example` — 环境变量模板（提交 git）

### 对外暴露（runwork/index.ts）

```typescript
// 只暴露这些，原项目代码只 import 这些
export { LoginModal } from './auth/LoginModal'
export { AuthInitializer } from './auth/AuthInitializer'
export { useRequireAuth } from './auth/useRequireAuth'
export { AccountInfoCard } from './account/AccountInfoCard'
export { ModelManagementPanel } from './settings/ModelManagementPanel'
```

---

## 3. 五个挂载点详细说明

### 挂载点 1：App.tsx（+3 行）

```tsx
import { LoginModal, AuthInitializer } from './runwork'   // +1 import

export default function App() {
  return (
    <>
      <AuthInitializer />        {/* +1 启动时静默检查 Token */}
      <AppShell />
      {/* ...原有内容全部不动 */}
      <LoginModal />             {/* +1 全局登录弹窗，按需显示 */}
    </>
  )
}
```

**移除**：原 `useAuthGate` hook + `if (!isLoggedIn) return <LoginScreen/>` 硬关卡逻辑全部删除。

### 挂载点 2：ipc.ts + preload（+25 行）

```typescript
// main/ipc.ts（+15 行）
import { handleSecureTokenGet, handleSecureTokenSet, handleSecureTokenClear } from './lib/runwork/auth-secure-storage'

ipcMain.handle('auth-secure:get-token', handleSecureTokenGet)
ipcMain.handle('auth-secure:set-token', handleSecureTokenSet)
ipcMain.handle('auth-secure:clear-token', handleSecureTokenClear)

// preload/index.ts（+10 行）
authSecure: {
  getToken: () => ipcRenderer.invoke('auth-secure:get-token'),
  setToken: (token: string) => ipcRenderer.invoke('auth-secure:set-token', token),
  clearToken: () => ipcRenderer.invoke('auth-secure:clear-token'),
}
```

### 挂载点 3：SettingsPanel.tsx（改 tab 引用）

```tsx
// 原来：{ id: "channels", label: "模型配置", icon: ... }
// 改为：
{ id: "model-management", label: "模型管理", icon: ... }

// renderTabContent 里：
case "model-management":
  return <ModelManagementPanel />   // 从 runwork/ import
```

### 挂载点 4：GeneralSettings.tsx（+2 行）

```tsx
import { AccountInfoCard } from '../../runwork'   // +1

export function GeneralSettings() {
  return (
    <div>
      <AccountInfoCard />    {/* +1 插在顶部 */}
      {/* 下面原有内容不动 */}
    </div>
  )
}
```

### 挂载点 5：Chat/Agent 发送按钮（各包一层）

```tsx
// ChatInput.tsx
import { useRequireAuth } from '../../runwork'    // +1
const requireAuth = useRequireAuth()             // +1

const handleSend = () => {
  requireAuth('发送消息', () => {                // 包一层
    sendMessage(text)                            // 原有代码不动
  })
}
```

AgentInput.tsx 同理，`requireAuth('创建 Agent 会话', () => { ... })`。

---

## 4. 核心数据流

### 4.1 App 启动流程

```
App 渲染（始终渲染 AppShell）
  ↓
AuthInitializer mount
  ↓
从 Keychain 读 Token
  ├─ 无 Token → authStatus = 'guest'（主界面可浏览）
  │
  └─ 有 Token → GET /auth/me 验证
       ├─ 401 → 清 Keychain → authStatus = 'guest'
       └─ 有效 → authStatus = 'authenticated'
                   ↓
              GET /auth/me/model-config
                   → SK 存内存（模块级变量，不进 atom）
                   → models 存 atom
                   → selectedModel 存 atom
                   → channel-sync：写入 channels.json
                   ↓
              GET /auth/me/model-usage
                   → 余额存 atom
```

### 4.2 未登录触发登录弹窗

```
用户点击"发送消息"
  ↓
useRequireAuth 检查 authStatus
  ├─ 'authenticated' → 直接执行发送
  └─ 'guest' → 设置 loginModalAtom:
                 { open: true,
                   reason: '登录后即可发送消息',
                   onSuccess: () => sendMessage(text) }
                 ↓
            LoginModal 弹出
                 ↓
            用户输入账号密码 → POST /auth/login
                 ↓
            成功 → Token 存 Keychain
                 → authStatus = 'authenticated'
                 → 拉取 model-config + model-usage
                 → 关闭弹窗
                 → 执行 onSuccess（消息发出去了）
```

### 4.3 退出登录

```
用户点"退出登录"
  ↓
清 Keychain Token
清内存 SK（模块级变量 = null）
authStatus = 'guest'
  ↓
用户还在主界面（不离开）
  ↓
继续浏览历史，调模型时会再弹登录
```

### 4.4 Token 过期（使用中）

```
用户在用 App，调 API 返回 401
  ↓
设置 loginModalAtom:
  { open: true,
    reason: '登录已过期，请重新登录',
    onSuccess: null }  ← 不需要回调，用户重新登录后继续用
  ↓
LoginModal 弹出（带"已过期"提示）
```

### 4.5 SK 失效（调模型 401）

```
Chat/Agent 调模型 → AgentSkill 返回 401
  ↓
自动重新拉 GET /auth/me/model-config
  ↓
用新 SK 重试一次
  ├─ 成功 → 用户无感，继续对话
  └─ 仍然 401 → 提示"账号可能已被禁用，请联系管理员"
```

---

## 5. SK 安全处理（文档红线）

### 5.1 SK 生命周期

```
启动 → GET /auth/me/model-config → SK 存模块级变量（非 atom）
  ↓
channels.json 的 apiKey 字段写占位符 "__RUNWORK_INJECT__"
  ↓
Chat/Agent 调模型前：
  从模块级变量读真实 SK → 替换占位符 → 发请求
  ↓
退出/登出：模块级变量 = null
```

### 5.2 为什么不存 atom

React DevTools 可以读 atom 的值。SK 存在模块级私有变量里，外部无法通过 DevTools 窥探。

```typescript
// runwork/model/model-config.ts
let skInMemory: string | null = null  // 模块级私有变量

export function getSK(): string | null {
  return skInMemory
}

export async function refreshModelConfig(): Promise<void> {
  const config = await fetchModelConfig()
  skInMemory = config.provider.apiKey  // 仅内存
  // channels.json 写占位符，不写真 SK
}
```

---

## 6. UI 设计

### 6.1 设置页「模型管理」（替换 ChannelSettings）

```
┌──────────────────────────────────────────────────┐
│  模型管理                                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  💰 余额                                    │  │
│  │                                            │  │
│  │  $3.77 / $5.00                             │  │
│  │  ████████████░░░░░░  75%                   │  │
│  │  已用 $1.23                                │  │
│  │  ──────────────────────────────            │  │
│  │  [购买余量 →]  [刷新]                      │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ════════════════════════════════════════════    │
│                                                  │
│  可用模型                              全选/全不选│
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ ☑  DeepSeek V4 Pro         ⭐ 推荐        │  │
│  │ ☑  GPT 5.5                                │  │
│  │ ☐  Claude Sonnet 4.5                      │  │
│  │ ☐  GPT 5.4 Mini                           │  │
│  │ ☐  Claude Haiku 3.5                       │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  已选 2 个模型                                    │
│                                                  │
│  默认模型：[ DeepSeek V4 Pro ▾ ]                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 6.2 设置页「通用设置」顶部（账号区块）

```
┌──────────────────────────────────────────────┐
│  通用设置                                     │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 账号                                   │  │
│  │                                        │  │
│  │ 👤 张三                                │  │
│  │ 📧 zhangsan@example.com               │  │
│  │ 🏢 明德律所 · 争议解决部               │  │
│  │ ────────────────────────────           │  │
│  │ [修改密码]        [退出登录]           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ─────────────────────────────────────────   │
│                                              │
│  （原有内容：用户档案、主题等）               │
│  ...                                         │
└──────────────────────────────────────────────┘
```

### 6.3 登录弹窗（LoginModal）

```
        ┌───────────────────────────┐
        │  🔐 登录后即可发送消息      │  ← 标题随触发来源变化
        │                           │
        │  邮箱                     │
        │  ┌─────────────────────┐  │
        │  │ zhangsan@example... │  │
        │  └─────────────────────┘  │
        │                           │
        │  密码                     │
        │  ┌─────────────────────┐  │
        │  │ ••••••••       [👁] │  │
        │  └─────────────────────┘  │
        │                           │
        │  ⚠ 错误提示区域（按需）    │
        │                           │
        │  [取消]      [登 录]      │
        └───────────────────────────┘
```

触发来源与标题对照：

| 触发来源 | 弹窗标题 |
|---|---|
| 未登录点"发送消息" | 登录后即可发送消息 |
| 未登录点"模型管理" | 登录后即可管理模型 |
| 未登录点"创建 Agent 会话" | 登录后即可创建会话 |
| Token 过期 | 登录已过期，请重新登录 |

### 6.4 Chat/Agent 模型选择器简化

```
当前：                          改后：
┌──────────────┐               ┌──────────────┐
│ 渠道: RunWork ▾ │               │              │
│ 模型: GPT5.5 ▾│    →         │ DeepSeek V4 ▾ │
└──────────────┘               └──────────────┘
                                 只显示勾选的模型
```

---

## 7. 类型定义（对齐服务端文档）

```typescript
// runwork/types.ts

/** 用户信息（POST /auth/login 和 GET /auth/me 返回） */
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
  createdAt: string
}

/** 模型配置（GET /auth/me/model-config 返回） */
export interface ModelConfig {
  status: 'active' | 'pending' | 'failed' | 'missing'
  provider: {
    id: string
    name: string
    baseUrl: string
    format: string        // 固定 'anthropic'
    apiKey: string        // SK（明文，仅内存使用）
    selectedModel: string
    models: ModelItem[]
  } | null
  binding: {
    status: string
    apiKeyMasked?: string
    quotaUsd?: number
    balanceUsd?: number
    usedUsd?: number
    currency?: string
    lastError?: string
  }
}

/** 模型项 */
export interface ModelItem {
  id: string
  name: string
  sortOrder: number
}

/** 用量（GET /auth/me/model-usage 返回） */
export interface ModelUsage {
  status: string
  quotaUsd: number
  usedUsd: number
  balanceUsd: number
  currency: string
  apiKeyMasked: string
  updatedAt: string
}

/** 认证状态 */
export type AuthStatus = 'loading' | 'authenticated' | 'guest'

/** 登录弹窗状态 */
export interface LoginModalState {
  open: boolean
  reason: string
  onSuccess: (() => void) | null
}
```

---

## 8. channel-sync：model-config → channels.json

### 8.1 写入逻辑

登录后 / model-config 拉取后，自动同步到 channels.json：

```typescript
// runwork/model/channel-sync.ts
import type { ModelConfig } from '../types'

const OFFICIAL_CHANNEL_ID = 'runwork-official'

export async function syncToChannels(config: ModelConfig): Promise<void> {
  if (!config.provider || config.status !== 'active') return

  // 读现有渠道
  const channels = await window.electronAPI.getChannels()

  // 找是否已有官方渠道
  const existing = channels.find(c => c.id === OFFICIAL_CHANNEL_ID)

  const officialChannel = {
    id: OFFICIAL_CHANNEL_ID,
    name: 'RunWork 官方',
    provider: 'anthropic',
    baseUrl: config.provider.baseUrl,
    apiKey: '__RUNWORK_INJECT__',        // 占位符，真 SK 在内存
    models: config.provider.models,
    selectedModel: config.provider.selectedModel,
    isOfficial: true,                  // 标记：UI 隐藏添加/删除/编辑
    enabled: true,
  }

  if (existing) {
    // 更新（保留用户的模型勾选偏好）
    Object.assign(existing, officialChannel, {
      // 不覆盖 models（用户勾选的子集），由 ModelManagementPanel 单独管
    })
  } else {
    channels.push(officialChannel)
  }

  await window.electronAPI.saveChannels(channels)
}
```

### 8.2 SK 占位符替换（调模型前）

```typescript
// runworkl/model/model-config.ts
let skInMemory: string | null = null

export function getSK(): string | null {
  return skInMemory
}

// Chat/Agent 调模型时，channel-sync 提供 hook：
// 在 channel.apiKey === '__RUNWORK_INJECT__' 时，用 getSK() 替换
export function resolveApiKey(channelApiKey: string): string | null {
  if (channelApiKey === '__RUNWORK_INJECT__') {
    return skInMemory
  }
  return channelApiKey
}
```

---

## 9. 错误处理矩阵

### 9.1 RunWork-Server 接口错误

| HTTP | error 文案 | code | 处理 |
|------|-----------|------|------|
| 401 | 认证失效 / 已过期 | - | 清 Token，弹登录窗（reason: 已过期） |
| 400 | 账号或密码错误 | - | 登录窗显示该文案 |
| 400 | 账号不可用 | - | 登录窗显示"账号已被禁用，请联系管理员" |
| 400 | 所属公司/团队已被禁用 | - | 登录窗显示对应文案 |
| 400 | 首次登录必须修改密码 | password_change_required | 登录成功后跳改密弹窗 |
| 网络错误 | - | - | 登录窗显示"无法连接服务器，请检查网络" |

### 9.2 AgentSkill 模型调用错误

| HTTP | 含义 | 处理 |
|------|------|------|
| 401 | SK 失效 | 自动重拉 model-config 取新 SK 重试一次；仍 401 → 提示联系管理员 |
| 402/429 | 余额不足/限流 | 提示用户购买余量 |
| 5xx | 服务异常 | 提示"模型服务暂时不可用"，可重试 |

---

## 10. 实施顺序

分 9 步，每步可独立验证 + 提交。

| 步骤 | 内容 | 文件 | 改原项目 |
|---|---|---|---|
| 1 | 类型定义 | `runwork/types.ts` | 否 |
| 2 | Keychain 安全存储 + IPC | `runwork/secure/auth-secure-storage.ts` + `ipc.ts` + `preload` | ✅ 挂载点 2 |
| 3 | 认证 API + 状态 | `runwork/auth/auth-api.ts` + `auth-state.ts` | 否 |
| 4 | model-config + SK 管理 + channel-sync | `runwork/model/*` | 否（运行时改 channels.json） |
| 5 | model-usage 余额 | `runwork/model/model-usage.ts` | 否 |
| 6 | 登录弹窗 + AuthInitializer + useRequireAuth | `runwork/auth/*` | 否 |
| 7 | App.tsx 挂载 LoginModal + AuthInitializer，移除旧硬关卡 | `App.tsx` | ✅ 挂载点 1 |
| 8 | 设置页：ModelManagementPanel + AccountInfoCard | `runwork/settings/*` + `runwork/account/*` + `SettingsPanel.tsx` + `GeneralSettings.tsx` | ✅ 挂载点 3、4 |
| 9 | Chat/Agent requireAuth + 模型选择器简化 | `ChatInput.tsx` + `AgentInput.tsx` | ✅ 挂载点 5 |

### 验证节点

- 步骤 2 后：typecheck 通过（IPC 通道注册正确）
- 步骤 6 后：typecheck + 弹窗组件可独立渲染
- 步骤 7 后：dev 启动，主界面可直接进入（guest 模式），调操作弹登录窗
- 步骤 9 后：完整端到端流程（登录 → 拉模型 → 对话 → 退出）

---

## 11. 与上游同步的冲突评估

| 上游改动场景 | 冲突难度 | 说明 |
|---|---|---|
| 新增 Skill / 修 bug / 加非渠道功能 | 🟢 容易 | runwork/ 完全不涉及 |
| App.tsx | 🟢 容易 | 只加了 3 行，git 多半自动合并 |
| Chat/Agent 发送逻辑 | 🟡 中等 | 包了 requireAuth，手动合并 1 处 |
| SettingsPanel tab 定义 | 🟡 中等 | 改了引用，手动合并 |
| GeneralSettings | 🟢 容易 | 只在顶部插入 |
| ipc.ts | 🟢 容易 | 只追加通道 |
| 大改渠道系统 | 🔴 难 | channel-sync 依赖渠道数据结构（但用户已确认渠道系统不会改） |

整体 90%+ 上游更新可低成本合并。

---

## 12. 配置文件方案

配置分两类，处理方式不同：

### 12.1 环境配置（构建期固定）→ .env 文件

服务地址这类**打包时就定死、所有用户一样**的配置，用 `.env` 环境变量。

**文件位置**：`apps/electron/.env`（不提交 git）

```bash
# apps/electron/.env
# RunWork-Server 认证服务地址（登录、验证 Token、拉配置）
VITE_RUNWORK_SERVER_URL=http://10.167.1.251:31006
```

**配套 .env.example**（提交 git，告诉其他开发者怎么配）：

```bash
# apps/electron/.env.example
# RunWork-Server 认证服务地址
VITE_RUNWORK_SERVER_URL=http://your-runwork-server:31006
```

**读取方式**：

```typescript
// 渲染进程（Vite 注入，需 VITE_ 前缀）
const SERVER_URL = import.meta.env.VITE_RUNWORK_SERVER_URL || 'http://10.167.1.251:31006'
```

**注意**：AgentSkill 的模型调用地址（baseUrl）**不写进 .env**——文档明确要求从 `/auth/me/model-config` 的 `provider.baseUrl` 动态获取。`.env` 里只放 RunWork-Server 地址这一个"入口地址"。

### 12.2 用户配置（运行时可变）→ JSON 文件

模型勾选、默认模型这类**每个用户不同、可随时改**的配置，用独立的 JSON 文件。

**文件位置**：`~/.runwork/runwork-config.json`（正式版）或 `~/.runwork-dev/runwork-config.json`（开发模式）

```json
{
  "selectedModelIds": ["deepseek-v4-pro", "gpt-5.5"],
  "defaultModelId": "deepseek-v4-pro"
}
```

**为什么独立文件而非复用 settings.json**：
- RunWork 模块代码独立，配置也应独立（符合与上游最小冲突原则）
- 自包含——将来删除 RunWork 改动，删掉 `runwork-config.json` 即可，不影响原项目配置

### 12.3 完整配置清单

| 配置项 | 位置 | 方式 | 谁维护 |
|---|---|---|---|
| RunWork-Server 地址 | `apps/electron/.env` | 环境变量（VITE_ 前缀） | 开发者（打包时定） |
| AgentSkill 地址 | 不存 | 从 model-config 动态获取 | 服务端 |
| SK（API Key） | 仅内存 | 模块级私有变量 | 运行时 |
| Token | Keychain | safeStorage | 系统级 |
| 模型勾选 | `~/.runwork-dev/runwork-config.json` | JSON 文件 | 用户 |
| 默认模型 | `~/.runwork-dev/runwork-config.json` | JSON 文件 | 用户 |

### 12.4 配置数据流

```
apps/electron/.env（构建期）
  VITE_RUNWORK_SERVER_URL
       ↓
runwork/ 模块启动时读取
       ↓
连接 RunWork-Server → 登录 → 拉取 model-config
       ↓                                    ↓
SK 存内存（不写磁盘）              provider.models 存 atom
       ↓                                    ↓
Chat/Agent 调模型时用              用户勾选 → ~/.runwork-dev/runwork-config.json
```

---

## 13. 接口验证结果（2026-07-04）

已用真实账号（2239553265@qq.com）对 `http://10.167.1.251:31006` 完成端到端验证，全部通过：

| # | 接口 | 状态 | 验证点 |
|---|---|---|---|
| 1 | `POST /auth/login` | ✅ | 返回 token + user，格式与文档一致 |
| 2 | `GET /auth/me` | ✅ | Token 验证通过，返回完整 user 信息 |
| 3 | `GET /auth/me/model-config` | ✅ | 返回 SK + 10 个模型 + 余额绑定信息 |
| 4 | `GET /auth/me/model-usage` | ✅ | 返回实时余额（$5.00 / 已用 $0） |
| 5 | `POST /auth/change-password` | ✅ | 改密成功，清除 mustChangePassword |
| 6 | `POST {baseUrl}/v1/messages` | ✅ | SK 直连 AgentSkill，模型正常响应 |

### 实际返回的关键数据

```
服务地址：http://10.167.1.251:31006（RunWork-Server）
模型调用地址：http://14.103.216.135:31006（AgentSkill，从 model-config 动态获取）
模型列表：10 个（DeepSeek V4 Pro / Qwen3.6 Plus / Kimi K2.5 / GPT-5.5 / GLM-5.2 /
                 GPT-5.4 / GPT-5.4 Mini / GLM-4.7 / MiniMax M2.5 / GLM-5）
默认模型：gpt-5.4-mini
余额：$5.00（已用 $0）
```

### 与文档的类型定义差异（需修正）

验证中发现实际返回比文档多了字段，类型定义需更新：

| 接口 | 多出的字段 | 处理 |
|---|---|---|
| `user` | `passwordChangedAt`, `lastLoginAt`, `updatedAt` | 补为可选字段 |
| `model-config.binding` | `quota`, `quotaUsed`, `quotaRemaining`, `groupKey`, `groupName`, `subgroupKey`, `subgroupName`, `channel`, `externalUserId`, `autoRechargeEnabled`, `autoRechargeThresholdUsd`, `autoRechargeAmountUsd`, `lastError` | 补全 binding 类型 |
| `model-config.models[]` | 没有 `sortOrder` 字段（文档说有但实际没有） | 改为可选 |

### 实际返回示例（model-config）

```json
{
  "success": true,
  "data": {
    "status": "active",
    "provider": {
      "id": "agentskill",
      "name": "AgentSkill",
      "baseUrl": "http://14.103.216.135:31006",
      "format": "anthropic",
      "apiKey": "sk-7dc1505a9e36d20e...",
      "selectedModel": "gpt-5.4-mini",
      "models": [
        { "id": "deepseek-v4-pro", "name": "DeepSeek V4 Pro" },
        { "id": "qwen3.6-plus", "name": "Qwen3.6 Plus" },
        { "id": "kimi-k2.5", "name": "Kimi K2.5" },
        { "id": "gpt-5.5", "name": "GPT-5.5" },
        { "id": "glm-5.2", "name": "GLM-5.2" },
        { "id": "gpt-5.4", "name": "GPT-5.4" },
        { "id": "gpt-5.4-mini", "name": "GPT-5.4 Mini" },
        { "id": "glm-4.7", "name": "GLM-4.7" },
        { "id": "MiniMax-M2.5", "name": "MiniMax M2.5" },
        { "id": "glm-5", "name": "GLM-5" }
      ]
    },
    "binding": {
      "status": "active",
      "apiKeyMasked": "sk-7...b0c7",
      "quota": 5,
      "quotaUsed": 0,
      "quotaRemaining": 5,
      "quotaUsd": 5,
      "usedUsd": 0,
      "balanceUsd": 5,
      "currency": "USD",
      "groupKey": "company:2",
      "groupName": "润下智能",
      "subgroupKey": "team:2",
      "subgroupName": "乖乖部门",
      "channel": "runwork",
      "externalUserId": "runwork:5",
      "autoRechargeEnabled": false,
      "autoRechargeThresholdUsd": 1,
      "autoRechargeAmountUsd": 10,
      "lastError": null,
      "updatedAt": "2026-06-17T16:19:45.722Z"
    }
  }
}
```

---

## 14. 修正后的类型定义（基于接口验证）

```typescript
// runwork/types.ts

/** 用户信息（POST /auth/login 和 GET /auth/me 返回） */
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

/** 模型项 */
export interface ModelItem {
  id: string
  name: string
  sortOrder?: number    // 文档说有，实际未返回，设为可选
}

/** 模型配置（GET /auth/me/model-config 返回） */
export interface ModelConfig {
  status: 'active' | 'pending' | 'failed' | 'missing'
  provider: {
    id: string
    name: string
    baseUrl: string
    format: string        // 固定 'anthropic'
    apiKey: string        // SK（明文，仅内存使用）
    selectedModel: string
    models: ModelItem[]
  } | null
  binding: {
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
}

/** 用量（GET /auth/me/model-usage 返回） */
export interface ModelUsage {
  status: string
  quota?: number
  quotaUsed?: number
  quotaRemaining?: number
  quotaUsd: number
  usedUsd: number
  balanceUsd: number
  currency: string
  apiKeyMasked: string
  updatedAt: string
}

/** 认证状态 */
export type AuthStatus = 'loading' | 'authenticated' | 'guest'

/** 登录弹窗状态 */
export interface LoginModalState {
  open: boolean
  reason: string
  onSuccess: (() => void) | null
}
```

---

## 15. 实施顺序（更新版）

分 10 步，每步可独立验证 + 提交。

| 步骤 | 内容 | 文件 | 改原项目 |
|---|---|---|---|
| 1 | 类型定义（用第 14 节修正版） | `runwork/types.ts` | 否 |
| 2 | .env 配置 + .env.example | `apps/electron/.env` + `.env.example` | 新增文件 |
| 3 | Keychain 安全存储 + IPC | `runwork/secure/auth-secure-storage.ts` + `ipc.ts` + `preload` | ✅ 挂载点 2 |
| 4 | 认证 API + 状态 | `runwork/auth/auth-api.ts` + `auth-state.ts` | 否 |
| 5 | model-config + SK 管理 + channel-sync | `runwork/model/*` | 否（运行时改 channels.json） |
| 6 | model-usage 余额 | `runwork/model/model-usage.ts` | 否 |
| 7 | runwork-config.json 读写 | `runwork/config/runwork-config.ts` | 否 |
| 8 | 登录弹窗 + AuthInitializer + useRequireAuth | `runwork/auth/*` | 否 |
| 9 | App.tsx 挂载 + 设置页 | `App.tsx` + `SettingsPanel.tsx` + `GeneralSettings.tsx` | ✅ 挂载点 1/3/4 |
| 10 | Chat/Agent requireAuth + 模型选择器 | `ChatInput.tsx` + `AgentInput.tsx` | ✅ 挂载点 5 |

---

## 16. 已确认事项

- [x] Chat/Agent 模型选择器：完全重写成"只选模型"（用户确认渠道系统不会再改）
- [x] 强制改密（mustChangePassword）：实现（接口已验证）
- [ ] 余额定时刷新：暂不实现，手动刷新按钮
- [x] 离线 guest 模式：可浏览历史，调模型时弹登录
- [x] 配置方案：.env（服务地址）+ runwork-config.json（用户偏好）
- [x] 接口验证：6 个接口全部通过
