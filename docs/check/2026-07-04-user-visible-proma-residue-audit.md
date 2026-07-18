# 审查记录：用户可见 "Proma" 残留全量排查

> 审查对象：commit `aeb9f3a1 refactor: 品牌重命名 @proma → @runwork` 的**用户可见层面**彻底性
> 审查日期：2026-07-04
> 审查动机：用户反馈"应用中仍能看到 Proma"——确认 brand-rename 不彻底
> 审查结论：**🔴 不彻底。约 30+ 处用户可见 "Proma" 文案未改，覆盖多个核心界面。**

---

## 问题本质

commit `aeb9f3a1` 只用 `sed` 做了 `@proma → @runwork`（包名）+ 少量手改（菜单栏标题、系统提示词自称）。但**用户可见的中文文案里**带 "Proma" 的，绝大多数**没有 `@` 前缀**，sed 没命中，手改也没覆盖到。

已改的代表（证明改动确有进行）：
- ✅ 菜单栏 `关于 RunWork / 隐藏 RunWork / 退出 RunWork`（menu.ts）
- ✅ 系统提示词自称 `你是 RunWork Agent`（agent-prompt-builder.ts:57）

未改的代表（用户会直接看到的）：
- 🔴 **首次启动欢迎页**："欢迎使用 Proma"
- 🔴 **渠道设置页**："Proma 官方供应｜稳定｜靠谱…"
- 🔴 **环境检查弹窗**："Proma 在 Windows 上需要 Git Bash…"
- 🔴 **托盘菜单**："打开 Proma / 退出 Proma"
- 🔴 **Agent 聊天气泡**："来自 Proma 定时任务"

---

## 🔴 残留清单（按用户可见场景分组）

### 场景 1：首次启动 / 引导页（OnboardingView）

**用户触达：第一次打开应用必见。**

| 行 | 文案 |
|---|---|
| `onboarding/OnboardingView.tsx:52` | `欢迎使用 Proma` （h1 标题） |
| `onboarding/OnboardingView.tsx:70` | `了解 Proma 的全部功能和使用技巧` |
| `onboarding/OnboardingView.tsx:76` | `自己或身边的人已经在用 Proma？直接导入现有配置` |
| `onboarding/OnboardingView.tsx:141` | `Proma 在 Windows 上需要 Git Bash 或 WSL 才能执行命令` |

> **影响最严重**——这是新用户对产品的第一印象。

---

### 场景 2：渠道设置页（ChannelSettings）

**用户触达：设置 → 渠道。**

| 行 | 文案 / 代码 |
|---|---|
| `ChannelSettings.tsx:390` | `function PromaProviderCard()` —— "官方供应商"推广卡片组件名 |
| `ChannelSettings.tsx:392` | `window.open('https://github.com/shanyu910/Proma/releases', '_blank')` |
| `ChannelSettings.tsx:397` | `label="Proma"` |
| `ChannelSettings.tsx:398` | `<img src={PromaLogo} alt="Proma" ... />` |
| `ChannelSettings.tsx:399` | `description="Proma 官方供应｜稳定｜靠谱｜丝滑｜简单｜可用于 Agent"` |

> 这里整张"官方供应商"卡片还是 Proma 品牌。需要决策：**移除整张卡片**（RunWork 没有官方供应商），还是改文案。

---

### 场景 3：Agent 技能 / MCP 页（AgentSkillsView + BuiltinMcpDetailSheet）

**用户触达：Agent 模式 → 技能/MCP 管理。**

| 行 | 文案 |
|---|---|
| `AgentSkillsView.tsx:394` | `在 Agent 模式下让 Proma 帮你联网查找并安装 Skill` |
| `AgentSkillsView.tsx:471` | `或在 Agent 模式下让 Proma 帮你查找并配置` |
| `AgentSkillsView.tsx:507` | `<McpSection title="Proma 内置" ...>` |
| `AgentSkillsView.tsx:514` | `command: 'Proma 运行时注入'` |
| `AgentSkillsView.tsx:519` | `targetLabel={... ?? 'Proma 运行时注入'}` |
| `BuiltinMcpDetailSheet.tsx:49` | `source: 'Proma 本地自动任务'` |
| `BuiltinMcpDetailSheet.tsx:50` | `自动任务 MCP 直接使用 Proma 本地任务服务…` |
| `BuiltinMcpDetailSheet.tsx:54` | `source: 'Proma 运行时'` |
| `BuiltinMcpDetailSheet.tsx:55` | `该内置 MCP 由 Proma 运行时托管。` |
| `BuiltinMcpDetailSheet.tsx:71` | `Proma 内置` |

---

### 场景 4：Agent 聊天界面（SDKMessageRenderer + AgentView）

**用户触达：Agent 对话中看到的消息气泡。**

| 行 | 文案 |
|---|---|
| `SDKMessageRenderer.tsx:874` | `title="来自 Proma 定时任务，点击查看设置"` |
| `SDKMessageRenderer.tsx:877` | `<span>来自 Proma 定时任务</span>` |

---

### 场景 5：环境检查弹窗（EnvironmentCheck）

**用户触达：Windows 用户环境不达标时弹出。**

| 行 | 文案 |
|---|---|
| `EnvironmentCheckPanel.tsx:111` | `Proma 在 Windows 上需要 Git Bash 或 WSL 才能运行 Agent` |
| `EnvironmentCheckDialog.tsx:29` | `检查并修复 Proma 运行所需的 Windows 本地环境` |

---

### 场景 6：自动化功能（Automation）

**用户触达：自动化任务的示例文案、空状态引导。**

| 行 | 文案 |
|---|---|
| `AutomationFormView.tsx:205` | `例：检查 Proma 仓库新增 issue，主动回复问答类问题…`（placeholder 示例） |
| `AutomationsListView.tsx:294` | `也可以在对话中用「以后每隔 X 分钟…」让 Proma 自动识别并创建。` |

---

### 场景 7：搜索对话框（SearchDialog）

**用户触达：全局搜索（Cmd+K 类入口）。**

| 行 | 文案 |
|---|---|
| `SearchDialog.tsx:363` | ``请帮我在 Proma 的全部会话历史中搜索…`` （发给 LLM 的 prompt，用户在输入框预填里可能看到） |

---

### 场景 8：语音输入设置（VoiceInputSettings）

**用户触达：设置 → 语音输入。**

| 行 | 文案 |
|---|---|
| `VoiceInputSettings.tsx:263` | `placeholder={"Proma\nJotia\nShadcnUI\nClaude Code"}`（占位词示例） |

---

### 场景 9：系统托盘菜单（tray.ts）

**用户触达：macOS 顶部菜单栏 / Windows 托盘右键。**

| 行 | 文案 |
|---|---|
| `tray.ts:104` | `label: '打开 Proma'` |
| `tray.ts:109` | `label: '退出 Proma'` |

> 与 menu.ts 已改的"关于 RunWork"形成**品牌不一致**——同是系统级入口，菜单栏改了托盘没改。

---

### 场景 10：Agent 错误提示 + 系统提示词（主进程）

**用户触达：Agent 报错时看到的提示；Agent 自我介绍/恢复上下文时复读。**

| 行 | 文案 / 代码 |
|---|---|
| `agent-orchestrator.ts:288` | `优先使用 Proma CLI 读取清洗后的会话历史…`（注入系统提示词） |
| `agent-orchestrator.ts:304` | `请先使用 Proma CLI 恢复完整上下文…` |
| `agent-orchestrator.ts:400` | `请先使用 Proma CLI 读取清洗后的会话历史…` |
| `agent-orchestrator.ts:457` | `优先使用 Proma CLI（也可以调用 session-cleaner skill…` |
| `agent-orchestrator.ts:1117` | `payload: 'https://proma.cool/download'`（更新提示链接） |
| `agent-orchestrator.ts:1123` | `payload: 'https://github.com/shanyu910/Proma/issues/new'`（反馈链接） |
| `adapters/claude-agent-adapter.ts:195` | `请检查是否选择了正确的 Proma 供应渠道和模型`（错误提示） |

> ⚠️ **关键矛盾**：实际 CLI bin name 已是 `runwork`，环境变量是 `RUNWORK_CLI`，但提示词告诉 Agent 用 "Proma CLI"——**品牌不一致 + 可能误导模型**。

---

### 场景 11：自动化 / 飞书通知（推送到第三方平台）

**用户触达：自动化任务推送到飞书时，飞书消息卡片标题带 "Proma"。**

| 行 | 文案 |
|---|---|
| `feishu-message.ts:57` | `content: 'Proma 错误'`（错误通知卡片标题） |
| `feishu-message.ts:220` | `content: 'Proma Bot 命令'`（Bot 命令卡片标题） |
| `feishu-message.ts:363` | `…请在 Proma 中查看完整回复` |
| `automation-notification-format.ts:53` | `…请在 Proma 中查看完整会话` |
| `text-output-service.ts:38` | `message: '已写入 Proma 输入框'` |

> 这些会**泄漏到用户的飞书群**，品牌污染外溢。

---

### 场景 12：菜单栏遗留的占位 URL

**用户触达：菜单 → 某个"项目主页"类入口。**

| 行 | 文案 |
|---|---|
| `menu.ts:115` | `shell.openExternal('https://github.com/yourusername/proma')` |

> 明显未完成的占位 URL，`yourusername/proma` 不是合法地址，且与 AboutSettings 的 `shanyu910/RunWork-pro` 不一致。

---

## 📊 汇总统计

| 类型 | 处数 | 用户可见性 |
|---|---|---|
| 渲染层中文文案（.tsx） | ~23 | 高（直接显示） |
| 主进程面向用户文本（菜单/通知/错误/提示词） | ~15 | 高 |
| **合计** | **~38** | — |

涉及文件约 15 个，全部位于 `apps/electron/src/`。

---

## 🔧 修复策略建议

这批残留**全部应该改为 RunWork**（无一是"内部功能性标识符"），建议分两类处理：

### A. 纯文案替换（Proma → RunWork）—— 安全，直接改

涉及：OnboardingView、AgentSkillsView、BuiltinMcpDetailSheet、SDKMessageRenderer、EnvironmentCheck、Automation、SearchDialog、VoiceInputSettings、tray.ts、agent-orchestrator（提示词）、claude-agent-adapter、feishu-message、automation-notification-format、text-output-service。

可用一条 sed 规则覆盖大部分（注意排除内部标识符）：

```bash
# 仅替换中文语境里的 "Proma"（前后是非字母字符），不动 PROMA_ 常量/PromaXxx 类型/proma-event
# 建议逐文件 Edit，便于 review
```

### B. 需要产品决策 —— 不能简单替换

| 位置 | 决策点 |
|---|---|
| `ChannelSettings.tsx` PromaProviderCard | **整张卡片如何处理**：移除？还是改成 RunWork 自有供应商入口？（RunWork 是否有"官方供应商"？） |
| `agent-orchestrator.ts:1117` `proma.cool/download` | 下载链接指向旧品牌站，是否改为 RunWork 发布页？ |
| `agent-orchestrator.ts:1123` + `ChannelSettings.tsx:392` | GitHub 链接统一到 `shanyu910/RunWork-pro` 还是保留 `shanyu910/Proma`（仓库名）？ |
| `menu.ts:115` `yourusername/proma` | **必改**（占位 bug），改为合法地址 |
| `lib/model-logo.ts` `PromaLogo` + `[/proma\.cool/i, PromaLogo]` | logo 资源匹配规则，是否需要为 RunWork 域名单独加规则？ |

---

## ✅ 确实"保留不改"的内部标识符（核对无误）

以下属于 commit message 声称保留的"内部功能性标识符"，**不属于本次遗漏**：

- `PROMA_DEFAULT_PERMISSION_MODE` 等常量
- `PromaPermissionMode` 类型
- `PROMA_LATEX_PROTECT`、`PROMA_AUTOMATION` 协议标记
- `__PROMA_ENV_START__` marker
- `localStorage` key `proma-*`
- `proma-code-block` 等 CSS class
- `getPromaUserAgent` 函数名
- `proma_event` 事件 kind
- `proma-workspace-${slug}:skill` 命名空间
- Logo 文件名 `proma-*.png`（内部资源标识）

---

## 附：核验命令

```bash
# 渲染层用户可见文案（排除内部标识符 + 排除 import/className）
grep -rn "Proma" apps/electron/src/renderer --include="*.tsx" \
  | grep -v node_modules \
  | grep -viE "import |from '@runwork|runwork-logos|atomWithStorage|className=|getPromaUserAgent|PromaPermissionMode|PROMA_|proma_event|proma-workspace|proma-code-block|proma-agent-process|PromaLogoSettings|PromaProviderCard|PromaLogo[^A-Za-z]|alt=\"Proma\"|/\*|\* "

# 主进程面向用户文本
grep -rn "Proma" apps/electron/src/main --include="*.ts" \
  | grep -v node_modules \
  | grep -viE "getPromaUserAgent|PromaPermissionMode|PROMA_|proma_event|proma-workspace|console\.log|//|/\*|\* |import |kind:"

# 验证已改的（应输出 RunWork）
grep -n "关于 RunWork\|你是 RunWork Agent" apps/electron/src/main/menu.ts apps/electron/src/main/lib/agent-prompt-builder.ts
```
