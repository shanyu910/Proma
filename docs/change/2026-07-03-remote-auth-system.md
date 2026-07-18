# 2026-07-03 登录认证系统

> 新增远端认证（登录/登出/会话校验），对接 RunWork-Server。服务器地址配置化而非硬编码。

---

## 背景与目的

RunWork 需要用户登录后才能使用，对接自建的 RunWork-Server 认证服务。相比 RunWork 项目原版的硬编码服务器地址，本次做了优化：**服务器地址通过 settings.json 配置化**，方便多环境部署。

## 改动范围

### 新增文件（3 个，自包含）

| 文件 | 行数 | 说明 |
|---|---|---|
| `renderer/atoms/auth.ts` | 155 | 认证状态 atoms + API 调用（login/checkSession/logout） |
| `renderer/atoms/auth.test.ts` | 35 | 退出登录状态重置的单元测试 |
| `renderer/components/auth/LoginScreen.tsx` | 161 | 登录界面（邮箱+密码，支持显示/隐藏密码） |

### 修改的文件

| 文件 | 改动 |
|---|---|
| `types/settings.ts` | `AppSettings` 新增 `authServerUrl?: string` 字段 |
| `main/lib/settings-service.ts` | 新增 `DEFAULT_AUTH_SERVER_URL` 常量 + 默认值注入 |
| `renderer/App.tsx` | 新增 `useAuthGate` hook + 认证关卡渲染逻辑 |

## 技术方案

### 服务器地址配置化（核心优化）

复用项目现有的 `~/.runwork/settings.json` 配置体系（与代理、飞书、钉钉配置同级）：

```json
// ~/.runwork/settings.json（或开发模式 ~/.runwork-dev/settings.json）
{
  "authServerUrl": "http://14.103.216.135:31006"
}
```

- 未配置时使用 `DEFAULT_AUTH_SERVER_URL` 默认值
- 用户可手动编辑 settings.json 修改地址
- 后续可在设置页加 UI 输入框（本次暂未做）

### 认证流程

```
应用启动
  ↓
useAuthGate() hook 执行
  ├─ 从主进程 settings 读取 authServerUrl → 注入 authServerUrlAtom
  ├─ 检查 localStorage 是否有缓存 token
  │   ├─ 无 token → 显示 LoginScreen
  │   └─ 有 token → 向 serverUrl/auth/me 验证
  │       ├─ 有效 → 显示主界面（AppShell）
  │       └─ 无效 → 清除 token → 显示 LoginScreen
  └─ 正在验证 → 空白占位（避免闪登录页）
```

### 入口集成方式

`App.tsx` 在 onboarding 之前插入认证关卡：

```tsx
const isLoggedIn = useAuthGate()
const [isChecking] = useAtom(isCheckingAtom)

// ⚠️ 所有 React.useEffect 必须在这两个条件 return 之前调用（Hooks 规则）
React.useEffect(() => {
  if (!isLoggedIn) { setIsLoading(false); return }
  // ... onboarding 初始化
}, [isLoggedIn])

if (isChecking) return <div className="h-screen w-screen bg-background" />
if (!isLoggedIn) return <TooltipProvider><LoginScreen /></TooltipProvider>
// 已登录 → 继续 onboarding / 主界面流程
```

### ⚠️ Hooks 顺序警示（重要陷阱）

> **commit `507ae8b4` 修复的回归**：初版把条件 `return` 放在了 `React.useEffect` **之前**，导致 Hooks 调用顺序在 `isChecking=true/false` 两次渲染间不一致，React 崩溃 → **登录后白屏**。

**在此处改动时必须遵守**：
1. 所有 `useEffect` / `useState` / 自定义 hook 调用必须在**所有条件 `return` 之前**
2. 认证关卡（`if (isChecking)` / `if (!isLoggedIn)`）只能用提前返回做渲染分流，不能用条件包裹 hook
3. 用 `useEffect` 的依赖项（`[isLoggedIn]`）+ 内部守卫（`if (!isLoggedIn) return`）控制何时执行 onboarding 逻辑

## 配置说明

### 修改认证服务器地址

编辑 `~/.runwork/settings.json`（正式版）或 `~/.runwork-dev/settings.json`（开发版）：

```json
{
  "authServerUrl": "https://your-auth-server.com"
}
```

### RunWork-Server API 契约

## 配置说明

### 修改认证服务器地址

编辑 `~/.runwork/settings.json`（正式版）或 `~/.runwork-dev/settings.json`（开发版）：

```json
{
  "authServerUrl": "https://your-auth-server.com"
}
```

### RunWork-Server API 契约

| 接口 | 方法 | 请求 | 响应 |
|---|---|---|---|
| `/auth/login` | POST | `{ email, password }` | `{ success, data: { token, user } }` |
| `/auth/me` | GET | Header: `Authorization: Bearer <token>` | `{ success, data: user }` |

```typescript
interface RemoteUser {
  id: number
  email: string
  fullName: string
  isAdmin: boolean
}
```

## 验证方式

```bash
bun test apps/electron/src/renderer/atoms/auth.test.ts   # 单元测试
bun run dev                                                 # 启动应显示登录页
# 输入测试账号 → 登录 → 主界面
# 重启应用 → token 有效则自动进入主界面
```

## 与上游的差异

`App.tsx` 是与上游同步时**最可能冲突**的文件（因为加了 useAuthGate）。解决策略：保留你的 auth 逻辑，合入上游对 AppShell/onboarding 的改动。

`settings.ts` 的 `authServerUrl` 字段是纯新增，几乎不冲突。

## 回滚方式

```bash
git revert 359e4147
```

## 后继修复

| commit | 说明 |
|---|---|
| `507ae8b4` | **登录后白屏**：修复 App.tsx Hooks 顺序违规（条件 return 在 useEffect 之前导致渲染崩溃）。详见上方「Hooks 顺序警示」。 |
