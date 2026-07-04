# 2026-07-03 品牌重命名 @proma → @legis

> 将所有 `@proma/*` 包名、根 name、CLI 命令名、用户数据目录、环境变量统一改为 `@legis` / `legis`。

---

## 背景与目的

Legis 是从 Proma fork 出来的独立品牌。为了让代码层面也体现品牌隔离，需要将 monorepo 的包作用域从 `@proma` 改为 `@legis`，同步更新所有相关的配置、路径和用户可见文案。

## 改动范围

### 必改文件（影响构建/解析/打包）

| 类别 | 改动 | 文件数 |
|---|---|---|
| 包 name 字段 | 6 个 package.json 的 `"@proma/xxx"` → `"@legis/xxx"` | 6 |
| 根 package.json | `"name": "proma"` → `"legis"`；`--filter='@proma/electron'` → `@legis/electron` | 1 |
| CLI bin name | `"proma": "./src/index.ts"` → `"legis": "./src/index.ts"` | 1 |
| workspace 依赖引用 | `"@proma/shared": "workspace:*"` → `@legis/*` | 6（重叠） |
| import 语句 | 所有 `from '@proma/xxx'` → `from '@legis/xxx'` | ~199 |
| userData 路径 | `main/index.ts:8` 的 `'@proma/electron-dev'` → `'@legis/electron-dev'` | 1 |
| 打包排除规则 | `electron-builder.yml` 的 `"!node_modules/@proma/**"` → `@legis/**` | 1 |
| 用户数据目录 | `config-paths.ts` 的 `.proma` → `.legis`，`PROMA_DEV` → `LEGIS_DEV` | 1 |
| 应用 ID | `appId: com.proma.app` → `com.legis.app`，`productName: Proma` → `Legis` | 1 |
| 文件扩展名 | `.proma-backup` / `.proma-share` → `.legis-backup` / `.legis-share` | 2 处 |
| CLI 环境变量 | `PROMA_CLI` → `LEGIS_CLI` | 3 处 |

### 用户可见文案

- macOS 菜单栏（menu.ts）：`关于 Proma` → `关于 Legis` 等
- Agent 系统提示词（agent-prompt-builder.ts）：`你是 Proma Agent` → `你是 Legis Agent`
- 设置页文案、教程标题、错误消息等
- AboutSettings 的 GitHub URL 指向 `shanyu910/Legis-pro`

### 保留不改（内部功能性标识符）

| 标识符 | 原因 |
|---|---|
| `PROMA_DEFAULT_PERMISSION_MODE` 等常量 | shared 包导出的内部代码标识符，用户不可见 |
| `PromaPermissionMode` 类型 | 同上 |
| `PROMA_LATEX_PROTECT`、`PROMA_AUTOMATION` 等协议标记 | 写进存储的消息内容，改了导致老数据无法解析 |
| `__PROMA_ENV_START__` | shell 环境解析 marker |
| localStorage key `proma-agent-*` | 改了丢用户设置（全新 fork 无此问题，但保守保留） |
| `proma-code-block` 等 CSS class | 内部 DOM 标识符 |
| `api.proma.cool` | 原作者的 API 服务地址（更新检查等） |
| `getPromaUserAgent` 函数名 | 内部代码标识符 |
| Logo 文件名 `proma-*.png` 及 import 变量 `proma*Logo` | 纯内部资源标识，用户不可见；目录已改为 `legis-logos/` |
| `proma_event` 事件 kind | agent-orchestrator 内部事件标识符 |
| `proma-workspace-${slug}:skill` 命名空间 | agent-orchestrator 内部命名空间标识符 |
| session-core 注释里的 "proma CLI" | 开发者可见注释，不影响运行时（6 处） |
| `release-notes/*.md` | 历史归档，保留原样 |

## 技术方案

用 `sed` 批量替换源码和配置文件中的 `@proma` → `@legis`（排除 node_modules、dist、bun.lock、release-notes），然后手动处理：
- 不带 `@` 的 `proma`（根 name、CLI bin、目录名）
- 用户数据目录名 `.proma` → `.legis`
- 环境变量 `PROMA_DEV` / `PROMA_CLI`
- 用户可见的品牌文案

`bun.lock` 不手改，最后 `bun install` 重新生成。

## 验证方式

```bash
bun install                    # 重新生成 bun.lock + 链接 @legis/* 包
bun run typecheck              # 类型检查通过
bun test                       # 所有测试通过
grep -rn "@proma" apps packages --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules | grep -v release-notes
# 期望：仅剩功能性标识符（PROMA_ 常量等），无包名残留
```

## 与上游的差异

上游每次新增文件都用 `@proma`，同步时需要 sed 批量改为 `@legis`。这是一次性操作，不会产生 git 冲突（因为是新文件）。

## 回滚方式

```bash
git revert aeb9f3a1
```

## 后继修复

| commit | 说明 | 属性 |
|---|---|---|
| `d090d8e8` | session-mirror 群名前缀 `Proma → Legis`（遗漏导致测试失败） | brand-rename 的补丁 |

## 已修复的遗漏（2026-07-04 审查后修复）

审查发现 `aeb9f3a1` 有以下遗漏，已在后续修复中处理：

| 问题 | 修复内容 |
|---|---|
| 系统提示词 "Proma CLI" | `agent-orchestrator.ts` 5 处改为 "Legis CLI"（与实际 bin name `legis` 和环境变量 `LEGIS_CLI` 一致） |
| `menu.ts:115` 占位 URL | `yourusername/proma` → `shanyu910/Proma` |
| `proma.cool/download` 下载链接 | → `shanyu910/Proma/releases`（ChannelSettings + agent-orchestrator） |
| `ErlichLiu/Proma/issues` 反馈链接 | → `shanyu910/Proma/issues`（agent-orchestrator） |
