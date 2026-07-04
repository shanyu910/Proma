# 审查记录：2026-07-03 品牌重命名 @proma → @legis

> 审查对象：[`docs/change/2026-07-03-brand-rename-proma-to-legis.md`](../change/2026-07-03-brand-rename-proma-to-legis.md)
> 对应提交：`aeb9f3a1 refactor: 品牌重命名 @proma → @legis`
> 审查日期：2026-07-04（变更落地次日）
> 审查范围：文档声明与代码现状的一致性核验

---

## 总体结论

文档作为**事后变更记录**（commit `aeb9f3a1`）结构清晰，"保留不改"清单基本反映了实际取舍。但存在 **若干与代码现状不符的缺漏**——主要是把一些**仍属用户可见或品牌相关**的残留项误归为"保留不改"或完全未提及。建议修订文档并补修遗漏项。

---

## ✅ 已核实准确的部分

| 文档声明 | 核实结果 |
|---|---|
| 6 个 `package.json` name 全部改为 `@legis/*` | ✅ root + 5 子包，无残留 `@proma` 包名 |
| CLI bin name `proma → legis` | ✅ `apps/cli/package.json` 已是 `"legis"` |
| `--filter='@legis/electron'` | ✅ root package.json 已改 |
| `PROMA_DEV → LEGIS_DEV`、`PROMA_CLI → LEGIS_CLI` | ✅ config-paths.ts / agent-orchestrator.ts / paths.ts 全部落地 |
| `appId / productName` 改动 | ✅ 落地 |
| 菜单栏"关于 Legis / 隐藏 Legis / 退出 Legis" | ✅ menu.ts 已改 |
| AboutSettings GitHub URL → `shanyu910/Legis-pro` | ✅ AboutSettings.tsx 已改 |
| 回滚 commit `aeb9f3a1` | ✅ 哈希、message 与 `git log` 一致，可直接 `git revert` |
| "保留不改"中的功能性标识符 | ✅ `PROMA_DEFAULT_PERMISSION_MODE`、`PromaPermissionMode`、`getPromaUserAgent`、`proma_event`、`proma-workspace-${slug}:skill`、`__PROMA_ENV_START__`、localStorage `proma-*` key、`proma-code-block` CSS class 等确实保留 |

---

## ⚠️ 文档遗漏 / 与现状不符的问题

### 问题 1：系统提示词里的 "Proma CLI" 文案未改，但文档声称已改

文档第 32 行明确写："Agent 系统提示词：`你是 Proma Agent` → `你是 Legis Agent`"。但实际代码中，**面向 Agent 的系统提示词里仍大量使用 "Proma CLI"**：

```
agent-orchestrator.ts:288  `优先使用 Proma CLI 读取清洗后的会话历史...`
agent-orchestrator.ts:304  `请先使用 Proma CLI 恢复完整上下文...`
agent-orchestrator.ts:400  `请先使用 Proma CLI 读取清洗后的会话历史...`
agent-orchestrator.ts:457  `优先使用 Proma CLI（也可以调用 session-cleaner skill...`
```

**关键矛盾**：CLI 的实际 bin name 已经叫 `legis`（`@legis/cli`），打包注入的环境变量是 `LEGIS_CLI`，prompt builder 里组装的命令字符串也用 `"$LEGIS_CLI"`（`agent-orchestrator.ts:282`）。也就是说**Agent 看到的提示词说 "Proma CLI"，但实际执行的是 `legis` 命令**——这不仅是品牌不一致，更可能让模型产生混淆。

**建议**：把这些系统提示词里的 "Proma CLI" 统一改为 "Legis CLI"（推荐），或在文档"保留不改"清单里显式列出并说明理由。

---

### 问题 2：`menu.ts:115` 遗留 `https://github.com/yourusername/proma`

```ts
await shell.openExternal('https://github.com/yourusername/proma')
```

这是一个**明显未完成的占位 URL**——`yourusername/proma` 既不是合法的 fork 地址，也和 AboutSettings 里指向的 `shanyu910/Legis-pro` 不一致。文档完全未提及。这属于明显的遗漏 bug，应当修复并补进文档。

---

### 问题 3：`packages/session-core` 里仍有面向开发者的 "proma CLI" 文案

```
packages/session-core/src/index.ts:4   唯一真源：Electron 主进程、proma CLI...
packages/session-core/src/index.ts:9   仅供 Node 侧（proma CLI / 主进程）使用...
packages/session-core/src/read.ts:6    Electron 主进程与 proma CLI 共用...
... 等 6 处
```

这些是源码注释（开发者可见），不影响运行时，但属于"品牌文案"范畴。文档既没列进"已改"，也没列进"保留不改"。建议在文档中补充说明（保留也合理，因为只是注释，但需要明示决策）。

---

### 问题 4：`ChannelSettings.tsx:392` 与 `agent-orchestrator.ts:1117` 指向 `proma.cool/download`

文档第 46 行把 `api.proma.cool` 列为"原作者 API 服务地址，保留"。但代码里实际还指向 **`proma.cool/download`**（一个**下载链接**，不是 API）：

```
ChannelSettings.tsx:392    window.open('http://proma.cool/download', '_blank')
agent-orchestrator.ts:1117 payload: 'https://proma.cool/download'
```

下载链接指向旧品牌站点，对 Legis 用户是误导。`api.proma.cool`（更新检查后端）保留可以理解，但 `proma.cool/download` **是面向用户的下载入口**，不属于"原作者 API 服务"。建议文档把这两类区分开，并考虑把 `/download` 链接也改为 Legis 自己的发布页。

---

### 问题 5：`ErlichLiu/Proma` issues 链接未处理

```
agent-orchestrator.ts:1123  payload: 'https://github.com/ErlichLiu/Proma/issues/new'
github-release-service.ts:17 owner: 'ErlichLiu'
```

错误提示里的"反馈 issues"链接还指向上游 `ErlichLiu/Proma`，会把 Legis 用户的 bug 报告送到原作者仓库。文档完全未提及。应当被显式记录——要么改成 `shanyu910/Legis-pro/issues`（与 AboutSettings 一致），要么在文档里明确"保留指向上游"的决策及理由。

---

### 问题 6：Logo 资源文件名 `proma-*.png` 与变量名未改（未在文档中说明）

```
PromaLogoSettings.tsx:18-35   import promaBlackLogo from '@/assets/bots/legis-logos/proma-black.png'
                              （14 个 logo 变量）
AppearanceSettings.tsx:39-51  同样 14 个 proma*Logo import
```

目录已改名 `legis-logos/`，但**图片文件名和 JS 变量名仍带 `proma` 前缀**。这是合理的"内部标识符可保留"情形，但数量很大（光这两个文件就贡献了 71 处 proma 匹配），文档"保留不改"清单却**完全没提到**。对审核者会造成困惑——"791 处 proma 残留到底都是啥？"。

**建议**：在"保留不改"清单补一行：

| 标识符 | 原因 |
|---|---|
| Logo 文件名 `proma-*.png` 及 import 变量 `proma*Logo` | 纯内部资源标识，用户不可见；目录已改为 `legis-logos/` |

---

## 📋 关于"791 处残留"的归类校验

抽样核对了 top 贡献文件，归类如下（与文档的"保留不改"口径基本一致）：

| 类别 | 代表位置 | 是否真"内部" | 文档是否说明 |
|---|---|---|---|
| Logo 文件名/变量 | PromaLogoSettings / AppearanceSettings | ✅ 内部 | ❌ 未说明（**问题 6**） |
| `PROMA_*` 常量 / `Proma*` 类型 | agent-orchestrator / agent-atoms | ✅ 内部 | ✅ 已列 |
| localStorage `proma-*` key | atoms/*.ts | ✅ 内部（改了丢设置） | ✅ 已列 |
| `getPromaUserAgent` 函数名 | user-agent.ts | ✅ 内部 | ✅ 已列 |
| `proma_event` 事件 kind | agent-orchestrator | ✅ 内部 | ❌ 未列，建议补 |
| `proma-workspace-${slug}:skill` | agent-orchestrator:1242 | ✅ 内部 | ❌ 未列，建议补 |
| **系统提示词 "Proma CLI"** | agent-orchestrator:288/304/400/457 | ❌ **非内部，品牌相关** | ❌ **问题 1** |
| **注释 "proma CLI"** | session-core/*.ts | 🟡 开发者可见 | ❌ **问题 3** |
| **下载/issues URL** | ChannelSettings / orchestrator / release-service | ❌ **非内部，用户可见** | ❌ **问题 4/5** |

---

## 🔧 建议的文档修订

1. **「保留不改」清单补 3 行**：Logo 文件名/变量、`proma_event` event kind、`proma-workspace-${slug}:skill` 命名空间。
2. **新增一节「待修复 / 已知遗漏」**，列出问题 1–5，每项标注：当前现状 + 推荐处理。其中 **问题 2（`menu.ts:115` 的 `yourusername/proma`）是明确的 bug**，建议直接修掉而不只是记录。
3. **第 32 行"用户可见文案"那段过于乐观**：实际"Agent 系统提示词"只改了 `你是 Proma Agent` 这一处，提示词主体里的 "Proma CLI" 全部遗留。建议把该行改写为更精确的描述。

---

## 附：审查时的核验命令

```bash
# 确认无包名残留（应无输出）
grep -rn "@proma" apps packages --include="*.ts" --include="*.tsx" --include="*.json" \
  | grep -v node_modules | grep -v release-notes

# 统计 proma 残留总数（审查时为 791 处，多为内部标识符）
grep -rni "proma" apps packages --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" \
  | grep -v node_modules | grep -v release-notes | grep -vi "api.proma" | wc -l

# 核实 env var 改名
grep -rn "LEGIS_CLI\|PROMA_CLI\|LEGIS_DEV\|PROMA_DEV" apps packages \
  --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules
```
