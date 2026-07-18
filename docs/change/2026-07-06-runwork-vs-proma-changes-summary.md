# RunWork 对 Proma 的完整修改总结

> 日期：2026-07-06
> 分支：`RunWork`（基于 `main` 的 `3e6f1d14`）
> 用途：归档 RunWork 分支相对于上游 Proma 的全部改动，便于团队理解和后续上游同步

---

## 一、整体规模

| 指标 | 数值 |
|------|------|
| **分支领先 main 的提交** | 47 个 |
| **新增文件** | 39 个 |
| **修改文件** | 278 个 |
| **删除文件** | 12 个 |
| **代码变更** | +8,059 行 / -4,547 行 |
| **新增核心模块** | `runwork/` 21 个文件，2,658 行 |

### 代码分布

| 目录 | 文件数 | 行数变化 |
|------|--------|---------|
| `runwork/` 模块（新增核心定制） | 21 | +2,658 |
| `renderer/`（修改的 UI 组件，非 runwork） | 135 | +719 / -1,692 |
| `main/`（修改的 IPC/服务） | 94 | +812 / -1,097 |
| `docs/`（文档） | 12 | +3,056 |
| `resources/`（图标等资源） | 28 | +74 / -453 |

---

## 二、五大改动维度

### 🔵 1. 品牌重命名（Proma → RunWork）

**最广泛的改动，覆盖 278 个文件**。系统性替换所有 `@proma` / `Proma` / `PROMA` 出现的地方：

- **包名**：`@proma/shared` → `@runwork/shared`，`@proma/electron` → `@runwork/electron` 等
- **路径别名**：`~/.proma/` → `~/.runwork/`（开发模式 `~/.runwork-dev/`）
- **UI 文案**：所有用户可见的 "Proma" 字样改为 "RunWork"
- **配置文件**：`package.json`、`electron-builder.yml`、`.env` 等
- **文档**：README、AGENTS.md、CLAUDE.md 全部同步

### 🎨 2. 应用图标系统替换

| 改动 | 说明 |
|------|------|
| **应用主图标** | 旧的"黑底白条纹"→ 新的**深蓝渐变背景 + 白色 L**（带 45° 切角） |
| **macOS 托盘图标** | 派生纯黑 L 剪影版（修复旧白色 Template 在浅色菜单栏不可见的 bug） |
| **图标生成脚本** | 修复 `generate-icons.sh` 路径 bug（`proma-logos` → `runwork-logos`） |
| **图标切换器** | 隐藏 AppIconPicker（最小冲突策略，保留死代码便于上游合并） |
| **品牌素材入口** | 隐藏 BotHubSettings 的"品牌素材"入口（旧 14 个条纹设计不一致） |

**图标文件清单**：
- `resources/icon.{svg,png,icns,ico}` — 应用主图标（全平台）
- `resources/runwork-logos/icon.svg` — 纯黑 L 剪影（派生托盘 Template）
- `resources/runwork-logos/iconTemplate{,@2x,@3x}.png` — macOS 托盘多分辨率
- `src/renderer/assets/models/runwork.png` — 渠道标题行 logo（256×256）

### 🔐 3. 完整登录/认证系统（新增 `runwork/` 模块，21 个文件）

这是**最核心的新增功能**，对接 RunWork-Server 后端。

#### 认证流程

```
启动 → AuthInitializer 静默验证 Token
  ├─ Token 有效 → 拉取 model-config + 余额
  ├─ Token 无效 → 清除 → guest 模式
  └─ 无 Token → guest 模式（只读浏览）
```

#### 模块结构

| 子模块 | 文件 | 职责 |
|--------|------|------|
| `auth/` | auth-api、auth-state、AuthInitializer、LoginModal、useAuthGate | 登录、Token 验证、登录弹窗、权限守卫 |
| `model/` | model-config、channel-sync、model-usage、post-login-refresh | SK 管理、模型列表同步、余额、登录后状态刷新 |
| `config/` | runwork-config | 用户偏好（模型勾选、默认模型）|
| `account/` | AccountMenu、ChangePasswordDialog | 侧边栏账号菜单、改密弹窗 |
| `secure/` | auth-secure-storage | Keychain Token 加密存储（safeStorage） |
| `settings/` | ModelManagementPanel | 模型管理设置页（替换原 ChannelSettings）|
| `types.ts` / `index.ts` | 类型定义 + 统一导出 | 对外 API 入口 |

#### 安全设计（红线）

- **SK 只存主进程内存**（`getSKInMemory()`），绝不写磁盘、不进 atom、不进日志
- **Token** 用 Electron `safeStorage` AES-256-GCM 加密存 `~/.runwork/auth-token.enc`
- 渲染进程通过 `RUNWORK_SK_PLACEHOLDER = '__RUNWORK_INJECT__'` 占位符 + 主进程 `decryptApiKey` 拦截

#### 访问控制

- 未登录 = 只读浏览模式（可看 UI，操作触发登录弹窗）
- Chat 输入框、Agent 输入框、ModelSelector 全部用 `useAuthGate` 守卫
- 设置页未登录显示"登录后即可管理模型"提示

### 🤖 4. AgentSkill 模型集成

#### 模型协议

标准 **Anthropic Messages API**（已实测验证 ✅，2026-07-06）

- **请求**：`POST {baseUrl}/v1/messages`
- **响应**：SSE 流（`message_start` / `content_block_delta` / `message_stop`）
- **鉴权**：`x-api-key: sk-xxx` header

#### 数据流

```
登录 → fetchModelConfigData（拉 SK + 模型列表）
     → syncModelConfigToChannels（写 channels.json + settings.json）
     → upsertOfficialChannel（固定 ID 'runwork-official'，避免 UUID 重复）
     → refreshStateAfterLogin（刷新 4 个 atom，免重启）
        ├─ channelsAtom          ← Chat ModelSelector
        ├─ agentChannelIdAtom    ← Agent AgentView
        ├─ agentChannelIdsAtom   ← Agent 渠道白名单
        ├─ agentModelIdAtom      ← Agent 默认模型
        └─ runworkConfigAtom       ← ModelSelector 过滤
```

#### 模型管理

- 设置页替换为 `ModelManagementPanel`（余额 + 模型勾选 + 默认模型）
- 余额显示：余额 + 已用 + 购买余量按钮（去掉了进度条）
- 模型勾选双向同步：设置页 → channels.json + localStorage，ModelSelector 读两个数据源

#### 修复的关键 bug（5 次）

1. **官方渠道 UUID 重复** → 用固定 ID `runwork-official`
2. **模型勾选后 ModelSelector 不刷新** → 加 `refreshChannels()`
3. **登录后必须重启才能看到模型** → 加 `refreshStateAfterLogin`（刷新 channelsAtom + agentChannelIdAtom + runworkConfigAtom）
4. **重启后显示所有模型** → ModelSelector 按 `selectedModelIds` 二次过滤官方渠道
5. **显示 Claude 图标** → `getChannelLogo` 加 `runwork-official` 特判

### 📝 5. 文档与测试

#### 新增文档（12 个文件，3,056 行）

- `docs/desktop-integration-guide.zh.md` — 服务端接口契约
- `docs/2026-07-06-合并文档.md` — 完整合并文档
- `docs/change/` — 4 份变更说明（品牌、认证、图标、定制总览）
- `docs/check/` — 3 份审查报告
- `docs/plans/` — 设计方案 + 后端修复提示词

#### 测试（4 个测试文件，44 个测试用例，BDD 风格）

| 文件 | 测试数 | 覆盖 |
|------|--------|------|
| `auth-api.test.ts` | 19 | 登录、Token 验证、改密、更新 profile |
| `runwork-config.test.ts` | 11 | 配置读写、模型勾选 |
| `channel-sync.test.ts` | 5 | 渠道同步 |
| `model-config.test.ts` | 9 | model-config 拉取、SK 管理 |

---

## 三、上游同步状态

| 指标 | 状态 |
|------|------|
| RunWork 基于 main 的 commit | `3e6f1d14`（fix agent mcp discovery scope） |
| main 当前最新 | `e51ac144`（fix input plain text copy） |
| **未合并的上游提交** | **29 个** |

**最小挂载点设计**带来的好处 —— 80% 的定制集中在独立的 `runwork/` 模块里，与上游 Proma 代码物理隔离。但 278 个文件的品牌重命名改动在合并上游时可能需要手工解决冲突。

### 上游同步策略

- `runwork/` 模块：零冲突（独立目录）
- 品牌重命名文件（`@runwork/*` 路径）：可能冲突，需手工合并
- 功能隐藏（`{false && ...}`）：零冲突（保留死代码）
- 资源文件（图标）：零冲突（二进制/独立文件）

---

## 四、核心设计原则（贯穿始终）

1. **本地存储优先**：所有配置文件 + JSONL，无本地数据库
2. **最小挂载点**：RunWork 定制代码集中在 `runwork/` 模块，对上游文件改动最小化
3. **条件渲染策略**：隐藏功能用 `{false && <Component/>}` 而非删除，便于上游合并
4. **SK 安全红线**：主进程内存 + 占位符 + decryptApiKey 拦截
5. **BDD 测试风格**：所有测试用 Given/When/Then 结构
6. **Jotai 状态管理**：全部用 atoms，符合 AGENTS.md 要求

---

## 五、关键文件索引

### 入口与挂载点

| 文件 | 作用 |
|------|------|
| `src/renderer/App.tsx` | 挂载 AuthInitializer + LoginModal |
| `src/renderer/main.tsx` | AgentSettingsInitializer 加载渠道 |
| `src/runwork/index.ts` | RunWork 模块统一导出 |

### 核心模块

| 文件 | 作用 |
|------|------|
| `runwork/auth/AuthInitializer.tsx` | 启动时静默验证 Token |
| `runwork/auth/LoginModal.tsx` | 登录弹窗 |
| `runwork/auth/auth-api.ts` | 登录/验证/改密 API |
| `runwork/auth/useAuthGate.ts` | 权限守卫 Hook |
| `runwork/secure/auth-secure-storage.ts` | Keychain + SK 主进程内存 |
| `runwork/model/model-config.ts` | model-config 拉取 + SK 同步 |
| `runwork/model/channel-sync.ts` | model-config → channels.json 同步 |
| `runwork/model/post-login-refresh.ts` | 登录后刷新全部相关 atom |
| `runwork/settings/ModelManagementPanel.tsx` | 模型管理设置页 |
| `runwork/account/AccountMenu.tsx` | 侧边栏账号菜单 |

### 主进程对接

| 文件 | 改动 |
|------|------|
| `src/main/ipc.ts` | 注册 RunWork IPC 通道（auth-secure / runworkSK / runworkChannel） |
| `src/main/lib/channel-manager.ts` | `upsertOfficialChannel` + `decryptApiKey` SK 拦截 |
| `src/preload/index.ts` | 暴露 `authSecure` / `runworkSK` / `runworkChannel` API |

### 配置文件

| 文件 | 说明 |
|------|------|
| `apps/electron/.env` | `VITE_RUNWORK_SERVER_URL`（gitignored，本地配置） |
| `apps/electron/.env.example` | 环境变量示例（已提交） |
| `apps/electron/vite.config.ts` | `envDir: resolve(__dirname)` 修复 .env 读取 |

---

## 六、环境配置

### 服务器地址（2026-07-06 当前）

| 服务 | 地址 | 用途 |
|------|------|------|
| 认证服务（本地测试） | `http://10.167.1.251:31006` | 登录、Token 验证、model-config |
| 认证服务（生产） | `http://14.103.216.135:31006` | 同上 |
| 模型服务 | `http://14.103.216.135:31003` | `/v1/messages` 调用 |
| 购买余量 | `http://14.103.216.135:31003/` | 余额充值页面 |

### 切换环境

修改 `apps/electron/.env`：
```
VITE_RUNWORK_SERVER_URL=http://10.167.1.251:31006   # 测试环境
VITE_RUNWORK_SERVER_URL=http://14.103.216.135:31006 # 生产环境
```

---

## 附：完整提交历史（47 个提交）

```
8162b30d feat: 替换应用图标为 RunWork 蓝 L 设计
034f8e0f fix: 去掉余额进度条和总额显示，只保留余额+已用+购买
2b226a5f fix: vite.config.ts 加 envDir，修复 .env 从未生效的问题
beb0356c feat: 用户名修改同步到服务端（POST /auth/me/profile）
8511833f test: 为 RunWork 模块补充单元测试（4 个文件，39 个测试）
fe9c3aa6 fix: 修复 7 个问题（功能缺失 + 代码冗余 + 死配置）
c09f073d docs: 新增 RunWork 合并文档（2026-07-06）
2bd2fb81 fix: RunWork-Server 地址改为 14.103.216.135:31006
0326b334 fix: 移除余额刷新调试日志
d29f9be6 debug: 加余额刷新调试日志（临时）
d8f11b42 fix: 余额刷新接口拿到数据后没存进 atom，导致 UI 不更新
fdf91e71 fix: 登录弹窗改用 Radix Dialog（!max-w-none + w-340px 确保宽度生效）
939b6021 fix: 登录弹窗宽度 380→340px，padding/gap 同步收紧
516d8a1b fix: 改密弹窗宽度 280→340px
36ca9e04 fix: 改密弹窗宽度真正生效（!important 覆盖 DialogContent 默认 w-full max-w-lg）
e3f79a4f fix: 改密弹窗宽度收窄 340→260px
17b485f2 fix: 缩小改密弹窗尺寸（max-w 380→340, padding/gap/字号全面收紧）
2bd28f4b fix: 改密弹窗用 Radix Dialog 替代手写 fixed 定位
7be0b34a feat(runwork): 修改密码功能完整实现
54b98448 fix: 账号菜单用 Radix Popover 替代手动定位，确保往上弹出
66bf21f4 refactor(runwork): 账号信息从设置页移到侧边栏弹出菜单（方案B）
3317fe86 fix: 购买余量链接改为正确地址 31003
7352f78c fix: 去掉输入框的'登录后开始对话'placeholder
8288bb15 fix(runwork): 修复模型勾选后 ModelSelector 不刷新
ad5707df fix(runwork): 模型勾选同步到渠道 + 初始化从渠道读取勾选
2c93e014 fix(runwork): 修复官方渠道 UUID 重复问题 + 模型选择器找不到渠道
220bdf30 fix(runwork): SK 主进程内存打通 + 登录后切换官方渠道
e6818340 feat(runwork): 未登录降级为只读浏览模式
89d00298 feat(runwork): 步骤10 Chat/Agent requireAuth（挂载点5）
6c9c6ae4 feat(runwork): 步骤9 App.tsx挂载 + 设置页（挂载点1/3/4）
fb97fb40 feat(runwork): 步骤6-8 余额+配置+登录弹窗+认证初始化
535737b1 feat(runwork): 步骤4-5 认证API + SK管理 + 渠道同步
5f586cce feat(runwork): 步骤1-3 类型定义 + .env配置 + Keychain安全存储
270f0ae3 docs: 更新认证方案——配置文件设计 + 接口验证结果 + 类型修正
4f3a1d71 fix: 移除设置页的教程入口（点击后无法进入教程）
28a42e49 fix: 清理4个内置 Skill 的 Proma 文案
dfd083b6 fix: 修复3个用户反馈问题（PROMA内置/提示词/教程）
5993df66 fix: 清理 30+ 处用户可见 Proma 文案残留
a1d4eadf revert: 撤销法务风格主题（legal-dark），保留原有主题系统
0dc45ba8 fix: 修复审查发现的代码遗漏 + 文档勘误
... (早期提交：品牌重命名、图标替换、文档等)
```
