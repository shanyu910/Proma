# Legis 桌面端集成指南（认证 / SK / 模型调用）

> 对接方：Legis 桌面端 App
> 服务端：Legis-Server（本项目）
> 版本：v1（对齐服务端 V2 架构，2026-07）
> 适用读者：桌面端 App 开发者
>
> 配套文档：
> - `docs/desktop-api.md` —— 服务端→桌面端的接口契约（字段级权威定义）
> - `docs/AgentSkill-API-Doc.md` —— Legis-Server↔AgentSkill 内部接口（背景知识）

---

## 0. 一分钟看懂

App 只和两个后端打交道：

```
┌─────────────┐   ①登录 ②拿SK ③看余额         ┌──────────────┐
│  Legis App  │ ────────────────────────────→ │ Legis-Server │
│  (桌面端)   │ ←─── Token / SK / 模型配置 ─── │  (本项目)    │
└──────┬──────┘                               └──────────────┘
       │
       │  ④用 SK 直连调模型 /v1/messages
       │  ⑤用同一套账号密码登录网页购买余量
       ↓
┌─────────────────┐
│   AgentSkill    │
│  (Token 中心)   │
└─────────────────┘
```

**核心原则（务必记住）**：

1. App 从 Legis-Server 拿到 SK（API Key）后，**模型调用直连 AgentSkill，不再经过 Legis-Server**。
2. **不要硬编码 AgentSkill 的地址**。每次启动从 `GET /auth/me/model-config` 返回的 `provider.baseUrl` 动态读取。
3. SK 是**明文密钥**，等价于密码，只在内存中使用，**绝不写磁盘/日志/崩溃报告**。

---

## 1. 三方关系与职责

| 角色 | 职责 | App 要做的事 |
|------|------|-------------|
| **Legis-Server** | 账号管理、登录认证、SK 加密存储与下发、用量/余额同步、Skill 分发 | 登录、拉配置、拉用量、下 Skill |
| **AgentSkill（Token 中心）** | 模型调用鉴权、用量计费、余量购买、账单 | 用 SK 调模型、登录网页买余量 |
| **Legis App** | 用户交互、本地安全存储 Token、SK 生命周期管理、模型调用 | 见下方各章节 |

### 1.1 一次完整的用户旅程

```
首次启动
  App（无 Token）→ 登录页 → POST /auth/login → 拿到 Token + user
       │
       ├─ user.mustChangePassword=true → 强制跳改密页 → POST /auth/change-password
       │
后续每次启动
  App（有 Token）→ GET /auth/me 验证 Token 是否仍有效
       │
       ├─ 401 → Token 过期，清本地、回登录页
       │
准备用模型
  GET /auth/me/model-config → 拿到 provider.{baseUrl, apiKey, format, models, selectedModel}
       │
       ├─ status != active → 显示"模型账号开通中/失败，请联系管理员"
       │
调用模型（直连 AgentSkill，不经 Legis-Server）
  POST {baseUrl}/v1/messages
    Headers: x-api-key: {apiKey}, anthropic-version: 2023-06-01
    Body:    { model, max_tokens, messages }
       │
看余额（两个途径任选）
  ① 直接调 AgentSkill（用户网页视角）
  ② GET /auth/me/model-usage → 服务端会反向同步上游、返回实时余额
       │
       └─ 余额不足 → 引导用户登录 AgentSkill 网页自助购买
```

---

## 2. 认证机制

### 2.1 Token 是什么

服务端使用**自实现的 HMAC-SHA256 签名 Token**（不是标准 JWT，但格式相似）：

```
<base64url(payload)>.<base64url(HMAC 签名)>

payload = {
  sub: <userId>,        // 用户 ID
  email: <邮箱>,
  isAdmin: <bool>,      // 桌面端用户固定为 false
  exp: <毫秒时间戳>      // 过期时间，签发时 = now + 7天
}
```

**特性**：
- **有效期 7 天**（自签发时刻起，无滑动续期）
- **无状态**：服务端不存 session，每次请求都用密钥重算签名 + 常数时间比较 + 校验 `exp`
- **不可撤销但可失效**：Token 本身无法吊销，但服务端每次会查 DB 校验用户状态——用户被禁用/公司团队被禁用时，即便 Token 未过期也会被拒

### 2.2 Token 怎么用

除登录外，**所有接口**都需在请求头携带：

```
Authorization: Bearer <token>
```

### 2.3 Token 安全存储（重要）

| 做 | 不做 |
|----|------|
| 存入系统级安全存储（macOS Keychain / Windows Credential Manager / Linux Secret Service） | 存明文配置文件、localStorage、桌面 SQLite |
| 收到 401 立即清除本地 Token | 把 Token 写进日志、崩溃上报、分析埋点 |
| App 启动先调 `GET /auth/me` 验证有效性 | 假设 Token 永久有效（用户可能被禁用） |

---

## 3. 登录流程

### 3.1 接口

```
POST /auth/login
Content-Type: application/json

{
  "email": "zhangsan@example.com",
  "password": "MyPass123!"
}
```

### 3.2 成功响应

```json
{
  "success": true,
  "data": {
    "token": "eyJzdWIiOjUsImVtYWlsIjoi...",
    "user": {
      "id": 5,
      "email": "zhangsan@example.com",
      "fullName": "张三",
      "isAdmin": false,
      "companyId": 3,
      "companyName": "明德律所",
      "teamId": 7,
      "teamName": "争议解决部",
      "status": "active",
      "mustChangePassword": false,
      "createdAt": "2026-06-01T10:00:00Z"
    }
  }
}
```

> 字段完整定义见 `docs/desktop-api.md` 第 1 节。

### 3.3 登录校验链（服务端会依次检查）

服务端 `assertUserCanLogin` 的校验顺序，决定了 App 会遇到哪些错误：

| 顺序 | 检查项 | 失败错误文案 | App 处理 |
|------|--------|-------------|---------|
| 1 | 邮箱+密码匹配 | `账号或密码错误` | 提示用户重输（**注意：账号不存在也返回这个文案，防枚举**） |
| 2 | `user.status === 'active'` | `账号不可用` | 提示"账号已被禁用，请联系管理员" |
| 3 | `company.status === 'active'` | `所属公司已被禁用` | 提示联系管理员 |
| 4 | `team.status === 'active'` | `所属团队已被禁用` | 提示联系管理员 |

> 管理员账号会跳过第 3、4 步（不绑组织）。桌面端用户固定是非管理员。

### 3.4 强制首次改密

如果管理员创建用户时设置了 `mustChangePassword=true`，**登录本身能成功**，但后续所有业务接口（`/auth/me`、`/skills`、`model-config` 等）会返回：

```json
{
  "success": false,
  "error": "首次登录必须修改密码",
  "code": "password_change_required"
}
```

**App 处理**：登录后检查 `user.mustChangePassword`，若为 `true` 立即跳改密页，调：

```
POST /auth/change-password
Authorization: Bearer <token>

{
  "currentPassword": "旧密码",
  "newPassword": "新密码（至少 8 位）"
}
```

成功后服务端会清掉 `mustChangePassword` 标志，后续接口恢复正常。

---

## 4. 获取 SK 与模型配置（核心）

### 4.1 接口

```
GET /auth/me/model-config
Authorization: Bearer <token>
```

这是 App 调模型的**唯一入口**——所有调模型需要的信息都从这里来。

### 4.2 成功响应（已开通）

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
      "apiKey": "sk-proj-xxxxxxxxxxxxxxxxxxxx",
      "selectedModel": "gpt-5.4-mini",
      "models": [
        { "id": "deepseek-v4-pro", "name": "DeepSeek V4 Pro", "sortOrder": 1 },
        { "id": "gpt-5.5", "name": "GPT 5.5", "sortOrder": 3 }
      ]
    },
    "binding": {
      "status": "active",
      "apiKeyMasked": "sk-proj-xxxx...xxxx",
      "quotaUsd": 5,
      "balanceUsd": 3.77,
      "usedUsd": 1.23,
      "currency": "USD"
    }
  }
}
```

### 4.3 字段含义与用途

| 字段 | 用途 | App 如何用 |
|------|------|-----------|
| `status` | 模型账号绑定状态 | 非 `active` 不能调模型（见 4.4） |
| `provider.baseUrl` | **AgentSkill 调模型入口** | 拼接成 `${baseUrl}/v1/messages` |
| `provider.format` | API 协议格式 | 当前固定 `"anthropic"`（Anthropic Messages API 兼容） |
| `provider.apiKey` | **用户的明文 SK** | 放进请求头 `x-api-key`（**仅存内存**） |
| `provider.selectedModel` | 默认推荐模型 | 作为模型选择器的默认值 |
| `provider.models` | 可选模型列表 | 渲染模型下拉框 |
| `binding.balanceUsd` | 剩余额度 | 余额展示（精确值见 `/auth/me/model-usage`） |

### 4.4 未开通/失败时的响应

```json
{
  "success": true,
  "data": {
    "status": "failed",
    "provider": null,
    "binding": {
      "status": "failed",
      "lastError": "AgentSkill provisioning failed: HTTP 404"
    }
  }
}
```

`status` 可能的值：

| status | 含义 | App 展示建议 |
|--------|------|-------------|
| `active` | 已开通，可正常调模型 | 显示余额、放开模型功能 |
| `pending` | 开通中（服务端已下发任务，上游处理中） | 显示"模型账号开通中，请稍候"，可定时轮询此接口 |
| `failed` | 开通失败 | 显示"模型账号开通失败，请联系管理员"，附 `binding.lastError` |
| `missing` | 未开通（用户刚建好，还没触发） | 显示"模型账号尚未开通，请联系管理员" |

---

## 5. SK（API Key）的安全处理

这是整套集成里**最敏感的数据**，务必遵守以下规则。

### 5.1 SK 的生命周期

```
管理员创建用户
  → Legis-Server 调 AgentSkill /provision 开通账号、拿回 SK
  → SK 以 base64 编码存入 DB（api_key_encrypted 字段）
  → 用户登录 App
  → GET /auth/me/model-config → 服务端解码 base64，明文返回 provider.apiKey
  → App 拿到明文 SK，存内存
  → App 用 SK 直连 AgentSkill 调模型
```

### 5.2 SK 存储与传输红线

| 必须做 | 禁止做 |
|--------|--------|
| 存内存（进程级变量） | 写磁盘（任何形式的缓存文件） |
| App 退出/登出时立即从内存清除 | 写日志、控制台输出、崩溃报告 |
| 每次启动重新拉取（管理员可能轮换过） | 长期缓存"复用上次 SK" |
| 通过 HTTPS 传输 | 通过 HTTP 明文链路传输 |

### 5.3 为什么不能缓存 SK

服务端支持**管理员强制轮换 SK**（`POST /admin/users/:id/agentskill/rotate-key`），轮换后旧 SK 立即失效，AgentSkill 会返回 401。如果 App 缓存了旧 SK，会导致调模型失败。

**正确做法**：每次启动都重新调 `GET /auth/me/model-config` 拿最新 SK。

### 5.4 SK 失效的两种情况

1. **管理员主动轮换** → 旧 SK 401 → App 应捕获 401，重新拉 `model-config` 取新 SK
2. **用户被禁用/销号** → SK 被吊销 → App 调模型 401，但此时 `model-config` 也会返回非 `active` 状态 → 引导用户联系管理员

---

## 6. 调用模型（直连 AgentSkill）

### 6.1 请求格式

```
POST {baseUrl}/v1/messages
```

> 当前生产 `baseUrl` 实际下发值为 `http://14.103.216.135:31006`（来自服务端 `.env` 的 `AGENTSKILL_PUBLIC_BASE_URL`）。**App 不要写死这个值**，永远从 `model-config` 动态读取——服务端切换地址时 App 无需发版。

**Headers**：

```
Content-Type: application/json
x-api-key: {provider.apiKey}
anthropic-version: 2023-06-01
```

**Body**（Anthropic Messages API 兼容格式）：

```json
{
  "model": "gpt-5.4-mini",
  "max_tokens": 1024,
  "messages": [
    { "role": "user", "content": "帮我审查这份合同的违约条款。" }
  ]
}
```

### 6.2 完整示例

```bash
# baseUrl 和 apiKey 均来自 GET /auth/me/model-config
curl -X POST http://14.103.216.135:31006/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-proj-xxxxxxxxxxxxxxxxxxxx" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-5.4-mini",
    "max_tokens": 1024,
    "messages": [{"role":"user","content":"你好"}]
  }'
```

### 6.3 模型选择

- **默认模型**：`provider.selectedModel`（当前为 `gpt-5.4-mini`）
- **可选模型**：`provider.models` 数组，建议渲染成下拉框供用户切换
- **`format` 字段固定为 `anthropic`**：意味着所有模型都用同一套 Anthropic Messages API 协议调用，App 不需要为不同模型适配不同 SDK

### 6.4 流式响应

支持标准 SSE 流式（`"stream": true`），格式遵循 Anthropic Messages API 流式规范：

```json
{
  "model": "gpt-5.4-mini",
  "max_tokens": 1024,
  "stream": true,
  "messages": [...]
}
```

App 应按 `data:` 前缀解析 SSE 事件，逐步渲染增量内容。

---

## 7. 用量与余额

### 7.1 接口

```
GET /auth/me/model-usage
Authorization: Bearer <token>
```

### 7.2 响应

```json
{
  "success": true,
  "data": {
    "status": "active",
    "quota": 0,
    "quotaUsed": 0,
    "quotaRemaining": 0,
    "quotaUsd": 5,
    "usedUsd": 1.23,
    "balanceUsd": 3.77,
    "currency": "USD",
    "apiKeyMasked": "sk-proj-xxxx...xxxx",
    "updatedAt": "2026-06-22T09:00:00Z"
}
```

### 7.3 关键说明

- **服务端会反向同步上游**：每次调此接口，服务端会先去 AgentSkill 拉最新用量再返回，所以响应是**实时数据**（会有约 200ms 额外延迟）。
- **看金额用 `quotaUsd/usedUsd/balanceUsd`**（美元口径），不要用 `quota/quotaUsed/quotaRemaining`（这是非美元的整数配额，当前场景一般为 0）。
- **低余额会触发服务端排队充值**：若用户开了自动充值且余额低于阈值，服务端会自动生成一条充值请求（受护栏限制，见服务端文档）。App 端无感。

### 7.4 余额不足怎么办

V2 架构下，**充值由用户自助完成**，App 的职责是引导：

> 检测到 `balanceUsd` 接近 0（如 `< 0.5`）或收到 AgentSkill 的余额不足错误 → 弹窗提示："余额不足，请前往 AgentSkill 网页购买余量"，并提供跳转链接。

> **注意**：用户登录 AgentSkill 网页用**与 Legis 同一套邮箱+密码**。这依赖服务端 `provision` 接口把 `password` 同步给 AgentSkill（需 AgentSkill v2+ 支持，详见 `docs/2026-07-02-agentskill-provision-add-password.zh.md`）。若该能力尚未落地，App 暂时提示"请联系管理员"。

---

## 8. 错误处理矩阵

### 8.1 Legis-Server 接口错误

| HTTP | error 文案 | code | App 处理 |
|------|-----------|------|---------|
| 401 | `认证失效` / `认证已过期` | - | 清 Token，跳登录页 |
| 400 | `账号或密码错误` | - | 登录页提示重输 |
| 400 | `账号不可用` | - | 提示联系管理员 |
| 400 | `所属公司已被禁用` / `所属团队已被禁用` | - | 提示联系管理员 |
| 400 | `首次登录必须修改密码` | `password_change_required` | 跳改密页 |
| 400 | `当前密码不正确` | - | 改密页提示重输 |
| 400 | `密码至少需要 8 位` | - | 改密页提示规则 |

> **判定规则**：服务端全局错误中间件对文案含"认证/过期"的返回 401，其余业务错误返回 400。

### 8.2 AgentSkill 模型调用错误

| HTTP | 含义 | App 处理 |
|------|------|---------|
| 200 | 成功 | 正常处理响应 |
| 401 | SK 失效（被轮换/吊销） | **重新拉 `model-config`**；若新 SK 仍 401 → 用户已被禁用，提示联系管理员 |
| 402 / 429 | 余额不足 / 限流 | 提示用户购买余量 |
| 400 | 请求参数错（如 model 不存在） | 检查请求体，回退到 `selectedModel` |
| 5xx | AgentSkill 服务异常 | 提示"模型服务暂时不可用"，可重试 |

---

## 9. Skill 分发（可选功能）

App 若要支持云端 Skill（如"合同审查助手"这类预置能力包），用以下 3 个接口：

| 接口 | 用途 |
|------|------|
| `GET /skills` | 已发布 Skill 列表（含版本、SHA256、文件树） |
| `GET /skills/:id` | 单个 Skill 元数据 |
| `GET /skills/:id/download` | 下载 zip 包 |

**下载校验**：响应头 `X-Legis-Skill-Sha256` 提供 SHA256，App 下载后应校验完整性；`X-Legis-Skill-Version` 确认版本号。

详见 `docs/desktop-api.md` 第 6-8 节。

---

## 10. 完整集成 Checklist

实现一个可上线的桌面端，按顺序勾选：

### 认证
- [ ] 登录页 → `POST /auth/login`，存 Token 到系统安全存储
- [ ] 启动时 `GET /auth/me` 验证 Token，401 则清登录态
- [ ] 处理 `mustChangePassword` → 跳改密页 → `POST /auth/change-password`
- [ ] 全局请求拦截器：自动带 `Authorization: Bearer`，401 自动跳登录

### SK 与模型
- [ ] 启动（或 token 刷新后）调 `GET /auth/me/model-config`
- [ ] 处理 4 种 `status`（active/pending/failed/missing），非 active 给明确提示
- [ ] **不缓存 SK**，每次启动重新拉取
- [ ] 用 `provider.{baseUrl, apiKey}` 直连 AgentSkill 调 `/v1/messages`
- [ ] 模型选择器用 `provider.models`，默认选 `provider.selectedModel`
- [ ] 捕获 AgentSkill 401 → 自动重拉 `model-config` 取新 SK 重试一次
- [ ] SK 仅存内存，退出/登出时清除，绝不写日志/磁盘

### 用量与购买
- [ ] 展示余额（用 `balanceUsd`），可定时（如每 5 分钟）调 `GET /auth/me/model-usage` 刷新
- [ ] 余额不足时引导用户去 AgentSkill 网页购买

### Skill（如需要）
- [ ] `GET /skills` 渲染列表
- [ ] `GET /skills/:id/download` 下载，用 `X-Legis-Skill-Sha256` 校验

---

## 附录 A：环境与地址

| 环境 | Legis-Server 地址 |
|------|------------------|
| 生产 | `http://14.103.216.135:31006` |
| 本地开发 | `http://127.0.0.1:3101` |

> AgentSkill 的 `baseUrl` **不要写死在 App 里**，永远从 `model-config` 动态获取。

## 附录 B：接口速查表

| # | 方法 | 路径 | 鉴权 | 用途 |
|---|------|------|------|------|
| 1 | POST | `/auth/login` | ❌ | 登录，拿 Token |
| 2 | GET | `/auth/me` | ✅ | 验证 Token、取用户信息 |
| 3 | GET | `/auth/me/model-config` | ✅ | **取 SK + 模型配置** |
| 4 | GET | `/auth/me/model-usage` | ✅ | 取实时余额/用量 |
| 5 | POST | `/auth/change-password` | ✅ | 改密 |
| 6 | GET | `/skills` | ✅ | Skill 列表 |
| 7 | GET | `/skills/:id` | ✅ | Skill 详情 |
| 8 | GET | `/skills/:id/download` | ✅ | 下载 Skill 包 |
| - | POST | `{baseUrl}/v1/messages` | SK | **调模型（直连 AgentSkill）** |
