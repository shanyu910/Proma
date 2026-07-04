# 2026-07-03 Legis 品牌定制总览

> 基于 Proma v0.14.2（SDK 0.3.197）fork，在 `Legis` 分支上完成品牌定制改造。

---

## 改动总览

| # | 改动 | 提交 | 说明 |
|---|---|---|---|
| 1 | 品牌重命名 `@proma → @legis` | `aeb9f3a1` | 全量包名、配置、文案重命名 |
| — | session-mirror 前缀修复 | `d090d8e8` | brand-rename 的补丁（群名前缀遗漏导致测试失败） |
| 2 | 替换应用图标为 Legis 品牌 | `9d1ef5ac` | 天平+盾牌法务主题图标 |
| 3 | 登录认证系统 | `359e4147` | 远端认证（配置化优化版） |
| — | 登录后白屏修复 | `507ae8b4` | auth 回归修复（App.tsx Hooks 顺序违规） |
| 4 | 新增法务风格主题 | `7cfa448c` | legal-dark 主题（保留原有） |

**详细文档**：
- [品牌重命名](./2026-07-03-brand-rename-proma-to-legis.md)
- [图标替换](./2026-07-03-logo-and-icon-replacement.md)
- [登录认证系统](./2026-07-03-remote-auth-system.md)
- [法务风格主题](./2026-07-03-legal-theme.md)

**审查报告**（change ↔ check 双向追溯）：
- [品牌重命名审查](../check/2026-07-04-brand-rename-proma-to-legis-review.md)
- [品牌定制联合审查](../check/2026-07-04-legis-brand-customization-review.md)

---

## 分支结构

```
origin (github.com/shanyu910/Proma)
├── main     ← 保持与上游 ErlichLiu/Proma 同步（干净）
└── Legis    ← 本次品牌定制改动（已推送）
```

上游同步：`git fetch upstream && git checkout main && git merge upstream/main`

---

## 与上游同步时的注意事项

以下文件**最容易与上游冲突**（因为本次改动过，上游也可能更新）：

| 文件 | 改动类别 | 冲突解决策略 |
|---|---|---|
| `App.tsx` | 认证关卡（useAuthGate） | 保留你的 auth 逻辑，合入上游的 AppShell 改动。⚠️ **Hooks 顺序敏感**：所有 `useEffect` 必须在条件 `return` 之前调用（见 `507ae8b4` 白屏修复） |
| `settings.ts` | 新增 authServerUrl + legal-dark | 两边的新增字段都要保留 |
| `globals.css` | 新增 .theme-legal-dark 块 | 块追加在末尾，几乎不冲突 |
| `AppearanceSettings.tsx` | 新增主题项 + grid 列数 | 合并 SPECIAL_STYLES 数组 |
| `electron-builder.yml` | appId/productName/扩展名 | 保留你的品牌配置 |

**几乎不会冲突的改动**：
- 所有 `@proma → @legis` 的 import 替换（上游新增文件用 `@proma`，sed 批量改即可）
- 图标二进制资源（直接用你的版本）
- 新增的 auth.ts / LoginScreen.tsx（独立文件）

---

## 待办事项（后续增强）

- [ ] 认证服务器地址的 UI 配置项（设置页加输入框）
- [ ] 法务风格主题的真实预览图（当前用 ocean-dark 占位）
- [ ] 品牌变体素材替换（proma-logos 目录下的变体还是 Proma 设计）
- [ ] 退出登录按钮 UI（当前只有 auth 逻辑，无 UI 入口）
