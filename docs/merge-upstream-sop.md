# 合并 Proma 上游更新操作手册（SOP）

> **用途**：每次 Proma 上游有更新时，按照本文档的步骤同步到 Legis 分支
> **前提**：你已经理解 `main`（跟上游同步）和 `Legis`（你的定制）的双分支结构
> **创建日期**：2026-07-08（基于 v0.0.4 合并实战总结）

---

## 一、什么时候需要合并

定期关注 Proma 上游更新：

```bash
# 检查上游有没有新提交
git fetch upstream
git log upstream/main --oneline -10
```

**建议频率**：
- 每 1-2 周检查一次
- 如果上游有重要 Bug 修复（看 commit message 里的 `fix`），尽快合并
- 大版本更新（如 v0.15.0）建议先在测试环境验证再合并

---

## 二、合并前准备

### 2.1 确认工作区干净

```bash
git checkout Legis
git status
# 必须是 "nothing to commit, working tree clean"
```

### 2.2 创建备份分支（重要！）

```bash
git branch Legis-backup-$(date +%Y%m%d)
# 例如：Legis-backup-20260708
# 万一合并出问题，可以一键回退
```

### 2.3 确认分支结构

```bash
git remote -v
# origin    → https://github.com/shanyu910/Proma.git  （你的 fork）
# upstream  → https://github.com/ErlichLiu/Proma.git   （上游）

git branch -vv
# * Legis  xxxxxxx [origin/Legis] ...
#   main   xxxxxxx [origin/main] ...
```

---

## 三、分析上游更新

### 3.1 拉取上游最新

```bash
git fetch upstream
```

### 3.2 查看新增了哪些提交

```bash
# 找到分叉点（你的 Legis 基于哪个 Proma commit）
MERGE_BASE=$(git merge-base Legis upstream/main)
echo "你的 Legis 基于: $MERGE_BASE"

# 查看上游新增了多少 commit
echo "新增 commit 数: $(git rev-list --count $MERGE_BASE..upstream/main)"

# 列出所有新 commit
git log $MERGE_BASE..upstream/main --oneline
```

### 3.3 分类评估

按以下标准分类每个 commit：

| 类别 | 判断标准 | 是否合并 |
|------|---------|---------|
| 🔴 **关键 Bug** | 含 "black screen"、"crash"、"EBUSY"、"memory"、"build failure" | ✅ 必须合并 |
| 🟡 **功能增强** | commit 以 `feat` 开头 | 看需求决定 |
| 🟢 **小优化** | commit 以 `fix` 开头但不是关键 Bug | 一般跟着合 |
| ⚪ **不相关** | 飞书、Tavily、DeepSeek 专属、其他 Provider 预设 | 可合可不合（合了也不影响） |
| 📄 **文档** | commit 以 `docs` 开头 | 一般跳过 |

### 3.4 检查冲突风险

```bash
# 上游改了哪些文件
git diff $MERGE_BASE..upstream/main --name-only | sort -u

# 重点检查：这些文件你定制过吗？
# 如果上游和你都改了同一文件 → 冲突
```

**Legis 定制过的关键文件**（合并时重点保护）：
```
apps/electron/src/legis/*                    ← Legis 全部新增模块
apps/electron/src/renderer/components/settings/AboutSettings.tsx
apps/electron/src/renderer/components/settings/AppearanceSettings.tsx
apps/electron/src/renderer/components/settings/BotHubSettings.tsx
apps/electron/src/renderer/components/settings/GeneralSettings.tsx
apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx
apps/electron/src/renderer/components/chat/ChatInput.tsx
apps/electron/src/renderer/components/chat/ModelSelector.tsx
apps/electron/src/renderer/components/agent/AgentView.tsx
apps/electron/src/main/lib/channel-manager.ts
apps/electron/src/main/lib/agent-orchestrator.ts
apps/electron/src/main/lib/agent-prompt-builder.ts
apps/electron/src/main/lib/updater/auto-updater.ts
apps/electron/src/main/lib/tutorial-service.ts
apps/electron/src/main/lib/github-release-service.ts
apps/electron/src/main/ipc.ts
apps/electron/src/preload/index.ts
apps/electron/src/main/index.ts
apps/electron/electron-builder.yml
.github/workflows/release.yml
```

---

## 四、执行合并

### 4.1 更新 main 分支

```bash
git checkout main
git merge upstream/main --ff-only
git push origin main
git checkout Legis
```

### 4.2 合并 main 到 Legis

```bash
git merge main --no-edit
```

### 4.3 如果有冲突

**冲突会显示：**
```
CONFLICT (content): Merge conflict in apps/electron/src/renderer/components/agent/AgentView.tsx
Automatic merge failed; fix conflicts and then commit the result.
```

**查看所有冲突文件：**
```bash
git diff --name-only --diff-filter=U
```

---

## 五、解决冲突的规则（重要！）

### 5.1 核心原则

| 冲突类型 | 处理方式 |
|---------|---------|
| `@proma/*` vs `@legis/*` 包名 | **保留 `@legis/*`** |
| `Proma` vs `Legis` 品牌文案 | **保留 `Legis`** |
| Legis 认证系统（auth、login、token） | **保留 Legis** |
| Legis 模型过滤（selectedModelIds） | **保留 Legis** |
| Legis 官方渠道（upsertOfficialChannel） | **保留 Legis** |
| 上游的功能改进（队列、滚动、UI） | **合并上游**（手工融合） |
| 上游的 Bug 修复 | **合并上游** |
| 上游的 SDK 升级 | **合并上游**（注意测试） |

### 5.2 品牌名检查清单

合并完成后，**必须全局检查品牌名没有泄漏**：

```bash
# 检查 @proma/* 引用（应为 0 或仅类型定义）
grep -rn "@proma/shared\|@proma/core\|@proma/session-core\|@proma/ui\|@proma/electron" \
  apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v dist/

# 检查 Proma 品牌文案（代码层面，排除注释和类型名）
grep -rn "Proma 内置\|Proma 官方\|欢迎来到 Proma\|了解 Proma\|Proma 使用教程" \
  apps/electron/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

**如果发现 `@proma/*` 引用，立即修复：**
```bash
# 批量替换（注意排除 PromaPermissionMode 等类型名）
sed -i '' "s|@proma/shared|@legis/shared|g" <文件路径>
sed -i '' "s|@proma/core|@legis/core|g" <文件路径>
sed -i '' "s|@proma/session-core|@legis/session-core|g" <文件路径>
```

### 5.3 特殊保留（不要改的名字）

以下标识符虽然含 "proma" 但**不能改成 legis**（会破坏功能）：

| 标识符 | 出现位置 | 为什么不改 |
|--------|---------|-----------|
| `PromaPermissionMode` | `@legis/shared` 类型定义 | API 类型名，改名影响面大 |
| `proma-workspace-${slug}` | `agent-workspace-manager.ts` | 磁盘上的 plugin 标识符，改名会破坏已有工作区 |
| `isPromaPermissionMode` | `@legis/shared` | 同上，类型守卫函数 |

### 5.4 上游新增文件的品牌化

上游可能新增文件（不带冲突标记自动合入），里面可能有 `@proma/*` 引用。

**合并后必须跑一遍品牌检查（见 5.2），修复所有新增文件的 `@proma/*`。**

---

## 六、合并后验证

### 6.1 重新安装依赖

```bash
bun install
```

### 6.2 类型检查

```bash
cd apps/electron && bunx tsc --noEmit -p tsconfig.json
# 退出码必须是 0
```

### 6.3 跑测试

```bash
bun test apps/electron/src/legis/
```

### 6.4 本地启动验证

```bash
bun run dev
# 手动测试：登录、发消息、切模型、Agent 模式
```

### 6.5 提交合并

```bash
git add -A
git commit -m "merge: 合并 Proma 上游 vX.X.X（N 个 commit）

合并内容：
- 关键 Bug 修复：...
- 功能增强：...

冲突解决：
- 保留 Legis 品牌名 @legis/*
- 保留 Legis 认证/模型定制
- 合并上游功能改进"
```

---

## 七、发布新版本

### 7.1 更新版本号

```bash
# apps/electron/package.json 的 version 字段递增
# 例如 0.0.4 → 0.0.5
```

### 7.2 提交 + 打 tag + 推送

```bash
git add apps/electron/package.json
git commit -m "chore: bump version 0.0.X → 0.0.Y"
git push origin Legis
git tag v0.0.Y
git push origin v0.0.Y
```

### 7.3 等 CI 跑完

```bash
gh run watch -R shanyu910/Proma  # 实时监控
# 或访问 https://github.com/shanyu910/Proma/actions
```

### 7.4 发布 Release

```bash
gh release edit v0.0.Y -R shanyu910/Proma \
  --title "Legis vX.X.X - 合并 Proma vX.X.X" \
  --notes "（填更新内容）" \
  --draft=false
```

---

## 八、回退方案（万一合并出问题）

```bash
# 如果合并后发现问题，想回退到合并前：
git checkout Legis
git reset --hard Legis-backup-YYYYMMDD

# 如果已经 push 了，强制推送：
git push origin Legis --force-with-lease

# 删除 tag（如果已创建）
git tag -d v0.0.Y
git push origin :refs/tags/v0.0.Y
```

---

## 九、常见冲突场景速查

### 场景 1：AgentView.tsx 冲突

**Legis 改了**：`useAuthGate` 登录态判断、`requireAuth` 包裹
**上游改了**：消息队列、滚动、附件处理

**解决**：保留 Legis 的认证逻辑，合并上游的功能逻辑。两套代码在不同位置，一般能共存。

### 场景 2：channel-manager.ts 冲突

**Legis 改了**：`upsertOfficialChannel`（固定 ID）、`decryptApiKey`（SK 占位符）
**上游改了**：模型发现逻辑、兼容性改进

**解决**：保留 Legis 的官方渠道逻辑，合并上游的模型发现改进。

### 场景 3：ipc.ts / preload/index.ts 冲突

**Legis 改了**：添加了 `legisSK`、`legisChannel`、`authSecure` 等 IPC
**上游改了**：添加了新的 IPC 通道

**解决**：两边都是"往同一个对象里加新字段"，不会真正冲突，手工合并即可。

### 场景 4：package.json 冲突

**Legis 改了**：`@legis/*` 包名、版本号
**上游改了**：依赖升级

**解决**：保留 `@legis/*` 包名，版本号用 Legis 独立的（不跟上游），依赖用上游的。

### 场景 5：上游新增的文件里有 @proma/* 引用

**现象**：合并后 typecheck 报错 `Cannot find module '@proma/shared'`
**原因**：上游新增的文件（不在冲突列表）自动合入，但引用了 `@proma/*`

**解决**：
```bash
# 全局检查并修复
grep -rln "@proma/shared\|@proma/core\|@proma/session-core" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules
# 逐个文件修复
sed -i '' "s|@proma/shared|@legis/shared|g" <文件路径>
```

---

## 十、合并记录

每次合并后在这里记录，方便追踪：

| 日期 | Legis 版本 | 上游版本 | 合并 commit 数 | 冲突文件数 | 备注 |
|------|-----------|---------|---------------|-----------|------|
| 2026-07-08 | v0.0.4 | v0.14.10 | 50 | 17 | 首次大规模合并 |
| | | | | | |

---

## 附录：一键合并脚本（可选）

如果对合并流程已经很熟练，可以用这个脚本快速执行：

```bash
#!/bin/bash
# merge-upstream.sh - 快速合并上游更新
set -e

echo "=== 1. 确认工作区干净 ==="
git checkout Legis
git status --porcelain && echo "❌ 工作区不干净，请先提交" && exit 1 || true

echo "=== 2. 备份 ==="
BACKUP_BRANCH="Legis-backup-$(date +%Y%m%d)"
git branch "$BACKUP_BRANCH"
echo "备份分支: $BACKUP_BRANCH"

echo "=== 3. 更新 main ==="
git checkout main
git fetch upstream
git merge upstream/main --ff-only
git push origin main

echo "=== 4. 合并到 Legis ==="
git checkout Legis
git merge main --no-edit || echo "⚠️  有冲突，请手动解决后 git commit"

echo "=== 5. 检查品牌名 ==="
grep -rn "@proma/shared\|@proma/core" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules && echo "⚠️  发现 @proma/* 引用，请修复" || echo "✅ 品牌名检查通过"

echo "=== 6. 验证 ==="
bun install
cd apps/electron && bunx tsc --noEmit -p tsconfig.json && echo "✅ 类型检查通过" || echo "❌ 类型检查失败"
```
