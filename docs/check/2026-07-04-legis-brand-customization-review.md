# 审查记录：2026-07-03 Legis 品牌定制系列变更（联合审查）

> 审查对象：`docs/change/2026-07-03-*.md` 共 5 份文档（除 brand-rename 单独成篇外，本文覆盖其余 4 份）
> 审查日期：2026-07-04（变更落地次日）
> 审查范围：文档声明与代码现状的一致性核验

---

## 审查对象清单

| # | 文档 | 对应提交 | 详见 |
|---|---|---|---|
| 1 | 品牌重命名 `@proma → @legis` | `aeb9f3a1` | [单独审查报告](./2026-07-04-brand-rename-proma-to-legis-review.md) |
| 2 | 法务风格主题 `legal-dark` | `7cfa448c` | 本文档 |
| 3 | Legis 品牌定制总览 | （聚合） | 本文档 |
| 4 | 应用图标替换 | `9d1ef5ac` | 本文档 |
| 5 | 远端登录认证系统 | `359e4147` | 本文档 |

---

## 总体结论

四份文档质量参差：

- **legal-theme 文档**：✅ 准确，无问题。
- **icon-replacement 文档**：⚠️ 有 2 处与现状不符（"15 个变体"、`iconTemplate`/`icon.svg` 路径描述）。
- **remote-auth-system 文档**：⚠️ 有 1 处明显错误（"5 个新增文件"实为 3 个）+ 行数描述与实际偏差大 + 未提及后继修复 commit `507ae8b4`（登录后白屏）。
- **overview 总览文档**：⚠️ 遗漏了后继修复 commit（白屏修复、session-mirror 修复归属错位），且未引用 brand-rename 的单独审查结论。

---

## 📄 文档 2：法务风格主题（legal-theme）

### ✅ 全部声明已核实准确

| 文档声明 | 核实结果 |
|---|---|
| `THEME_STYLES` 追加 `'legal-dark'` | ✅ `types/settings.ts:166` |
| `.theme-legal-dark` CSS 变量块 | ✅ `globals.css:521` |
| AppearanceSettings 追加项 + grid 列数 7→4 | ✅ `SPECIAL_STYLES` 含 `legal-dark`；grid 为 `grid-cols-4` |
| titlebar-overlay `THEME_COLORS` 追加 | ✅ `titlebar-overlay.ts:24` `'legal-dark': { color: '#111622', symbolColor: '#ebe3d0' }` |
| 预览图暂用 ocean-dark 占位 | ✅ **MD5 完全一致**：`theme-legal-dark.webp` ≡ `theme-ocean-dark.webp`（`c42ed869...`），确为占位 |
| 回滚 commit `7cfa448c` | ✅ 哈希、message 一致 |

**结论：无问题。**

---

## 📄 文档 3：Legis 品牌定制总览（overview）

### ⚠️ 问题 O-1：遗漏后继修复 commit `507ae8b4`（登录后白屏）

总览的"改动总览"表止于 `d090d8e8`，但实际 `git log` 显示在其后还有：

```
507ae8b4 fix: 登录后白屏 — 修复 App.tsx Hooks 顺序违规
```

这是认证系统（文档 5）落地后**立即出现的回归修复**，属于本系列变更的有机组成部分，总览应收录。该 commit 反映出 `useAuthGate` 的引入破坏了 React Hooks 调用顺序——这是认证关卡集成方式的一个**设计警示**，应当被记录，而不是被后续 commit 默默修掉后从历史中消失。

**建议**：总览表补一行，并在"与上游同步注意事项"中提示 `App.tsx` 的 Hooks 顺序敏感性。

### ⚠️ 问题 O-2：`d090d8e8`（session-mirror 前缀修复）归属不清

总览把 `d090d8e8` 列为独立条目"session-mirror 前缀修复"，但它本质是 **brand-rename（`aeb9f3a1`）的遗漏补丁**——群名前缀没改干净导致测试失败。把它和品牌重命名并列为同级行，会让人误以为是独立功能。

**建议**：要么把它并入 brand-rename 行作为"含后继修复"，要么在备注里点明"brand-rename 的补丁"。

### ✅ 其余声明已核实准确

| 文档声明 | 核实结果 |
|---|---|
| 基于 Proma v0.14.2（SDK 0.3.197） | ✅ `apps/electron/package.json` version `0.14.2`；root overrides `0.3.197` |
| 分支 `origin/shanyu910/Proma`，含 `main` + `Legis` | ✅ remote 与 branch 验证一致 |
| 4 份子文档链接 | ✅ 全部存在 |
| 冲突文件清单（App.tsx / settings.ts / globals.css / AppearanceSettings / electron-builder.yml） | ✅ 合理，与各子文档一致 |
| 待办事项（authServerUrl UI / 真实预览图 / 品牌变体素材 / 退出登录按钮） | ✅ 与实际代码状态吻合（均为未完成项） |

---

## 📄 文档 4：应用图标替换（icon-replacement）

### ⚠️ 问题 I-1：品牌变体数量"15 个"与实际不符

文档第 40 行写"15 个变体"，实际：

- `resources/legis-logos/`：含 **14 个** `proma-*.png` 变体（+ `icon.svg` + 3 个 `iconTemplate*`，共 18 项）
- `renderer/assets/bots/legis-logos/`：**14 个** `proma-*.png` 变体

两处都是 **14 个**，不是 15。建议改为"14 个"或模糊表述"十余个变体"。

### ⚠️ 问题 I-2：`iconTemplate` / `icon.svg` 的"保留原样"描述误导

文档第 41–42 行：
> - 托盘图标 `iconTemplate*.png`：基于 `icon.svg` 的条纹设计…保持原样。
> - `icon.svg` 源文件：未改动（Legis 和 Proma 的 svg 源相同）。

实际文件分布与文档暗示不符：

- 托盘图标 `iconTemplate*.png`（3 个）**实际位于 `resources/legis-logos/` 目录内**，而非 `resources/` 根目录。文档把它们和主图标混在"保留的部分"里，容易让人误以为它们在根目录且未参与目录重命名——实际上它们是随 `proma-logos → legis-logos` 一起被移动的。
- `icon.svg` **同时存在两处**：`resources/icon.svg`（根，1560 字节）和 `resources/legis-logos/icon.svg`（logos 目录内）。文档只提"未改动"，没说明这两份及其与图标生成链路（`generate-icons.sh`）的关系。

**建议**：明确写出 `iconTemplate*` 和 `icon.svg` 都位于 `legis-logos/` 目录内（随目录重命名移动），并说明它们是托盘图标与图标生成链路的源文件。

### ✅ 其余声明已核实准确

| 文档声明 | 核实结果 |
|---|---|
| 三个主图标文件已替换 | ✅ `icon.png/icns/ico` 均存在，时间戳 07-03 22:59 |
| 目录重命名 `proma-logos → legis-logos`（两处） | ✅ 两个旧目录均不存在，新目录存在 |
| `tray.ts` 路径同步 `proma-logos → legis-logos` | ✅ `tray.ts:26-27` 已改 |
| `electron-builder.yml` extraResources 路径 | ✅ `from: resources/legis-logos` / `to: legis-logos` |
| 回滚 commit `9d1ef5ac` | ✅ 哈希、message 一致 |

---

## 📄 文档 5：远端登录认证系统（remote-auth-system）

### 🔴 问题 A-1（错误）：新增文件数"5 个"实为 3 个

文档第 13 行标题写"**新增文件（5 个，自包含）**"，但表格里**只列了 3 个**（`auth.ts` / `auth.test.ts` / `LoginScreen.tsx`），`git show 359e4147 --diff-filter=A` 也确认**实际只新增了这 3 个文件**。

标题与内容、与代码三方不一致。应为 **3 个**。

### ⚠️ 问题 A-2：行数描述与实际偏差大

| 文件 | 文档声称 | 实际（`wc -l`） | 偏差 |
|---|---|---|---|
| `auth.ts` | ~190 | 155 | -35（偏多 22%） |
| `auth.test.ts` | ~35 | 35 | ✅ 准确 |
| `LoginScreen.tsx` | ~180 | 161 | -19（偏多 12%） |

`auth.ts` 偏差最大。建议按实际值修正，或去掉具体数字只标"自包含"。

### 🔴 问题 A-3（重要遗漏）：未记录后继回归修复 `507ae8b4`（登录后白屏）

认证系统落地后，紧接着出现了 **`507ae8b4 fix: 登录后白屏 — 修复 App.tsx Hooks 顺序违规`**。这说明文档第 61–72 行描述的"入口集成方式"（在 `App.tsx` 中插入 `useAuthGate` + 提前 `return`）**初版破坏了 React Hooks 调用顺序规则**，是一个真实回归。

文档当前的"入口集成方式"代码示例是**修复后**的形态（`useAuthGate()` 在组件顶部调用），但完全没有提示：
1. 这里曾有一个 Hooks 顺序的坑；
2. 为什么 `useAuthGate` 必须在所有条件 return 之前调用；
3. 后续在此处改动时需保持 Hooks 调用顺序稳定。

**建议**：在"入口集成方式"小节补一段 **⚠️ Hooks 顺序警示**，并回链 commit `507ae8b4`。这对未来在此处改动的人是重要陷阱预警。

### ✅ 其余声明已核实准确

| 文档声明 | 核实结果 |
|---|---|
| `AppSettings` 新增 `authServerUrl?: string` | ✅ `types/settings.ts:263` |
| `settings-service.ts` 注入 `DEFAULT_AUTH_SERVER_URL` | ✅ 常量值 `http://14.103.216.135:31006`，4 处引用 |
| `App.tsx` `useAuthGate` + `isCheckingAtom` + `LoginScreen` | ✅ 三者均在 `App.tsx` 中正确集成 |
| 配置路径 `~/.legis/settings.json` | ✅ 与 brand-rename 后的目录命名一致 |
| 回滚 commit `359e4147` | ✅ 哈希、message 一致 |

---

## 🔧 统一建议

### 1. 各文档统一补"后继修复"指针

品牌定制是一个**持续演化**的系列，落地后出现了回归修复。建议每份子文档在"回滚方式"之后统一加一节 **「后继修复」**，列出影响本变更的后续 commit：

| 文档 | 后继修复 commit |
|---|---|
| brand-rename | `d090d8e8`（session-mirror 前缀）、（及 brand-rename 审查报告中的 5 项遗漏） |
| remote-auth-system | `507ae8b4`（登录后白屏 / Hooks 顺序） |
| overview | 把上述修复全部收入总览表 |

### 2. overview 总览应回链审查报告

总览文档目前只链接了 4 份 change 文档。建议补充链接到 `docs/check/` 下的两份审查报告，形成 `change ↔ check` 的双向追溯。

### 3. 优先级建议

- **🔴 必须修**（事实错误）：A-1（5→3 个文件）、A-3（白屏回归未记录，含陷阱预警价值）
- **⚠️ 建议修**（描述偏差）：I-1（变体数量）、I-2（iconTemplate 路径）、A-2（行数）、O-1/O-2（总览遗漏与归属）
- **✅ 无需改**：legal-theme 文档

---

## 附：审查核验命令汇总

```bash
# 验证所有引用的 commit 哈希
git log --format="%H %s" aeb9f3a1 7cfa448c 9d1ef5ac 359e4147 d090d8e8 507ae8b4 -6

# legal-theme 核验
grep -n "legal-dark" apps/electron/src/types/settings.ts
grep -n "theme-legal-dark" apps/electron/src/renderer/styles/globals.css
md5 apps/electron/src/renderer/assets/theme-previews/theme-legal-dark.webp \
    apps/electron/src/renderer/assets/theme-previews/theme-ocean-dark.webp   # 应一致

# icon-replacement 核验
ls apps/electron/resources/legis-logos/ | wc -l            # 18（含 14 变体 + icon.svg + 3 iconTemplate）
ls apps/electron/src/renderer/assets/bots/legis-logos/ | wc -l   # 14
grep -n "legis-logos" apps/electron/src/main/tray.ts

# remote-auth-system 核验
git show 359e4147 --diff-filter=A --name-only --format=""   # 仅 3 个新增文件
wc -l apps/electron/src/renderer/atoms/auth.ts apps/electron/src/renderer/components/auth/LoginScreen.tsx
grep -n "useAuthGate\|isCheckingAtom" apps/electron/src/renderer/App.tsx
```
