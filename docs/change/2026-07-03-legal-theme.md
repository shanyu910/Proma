# 2026-07-03 法务风格主题（legal-dark）

> 在现有 7 个特殊主题基础上，新增第 8 个"法务风格"主题 `legal-dark`，保留所有原有主题。

---

## 背景与目的

Legis 品牌定位为法务领域，需要一个符合品牌调性的专属主题。法务风格的视觉特征：**海军蓝底色（庄重）+ 暖金强调（黄铜印章感）+ 直角几何（严谨）**。

与 Legis 项目原版的"替换式主题"不同，本次采用**新增式**——不删除任何原有主题，法务风格作为第 8 个特殊风格选项加入。

## 改动范围

| 文件 | 改动 |
|---|---|
| `types/settings.ts` | `THEME_STYLES` 数组追加 `'legal-dark'` |
| `styles/globals.css` | 新增 `.theme-legal-dark` CSS 变量块（~45 行） |
| `components/settings/AppearanceSettings.tsx` | import 预览图 + `SPECIAL_STYLES` 追加项 + grid 列数 7→4 |
| `assets/theme-previews/theme-legal-dark.webp` | 预览图（暂用 ocean-dark 占位） |
| `main/lib/titlebar-overlay.ts` | `THEME_COLORS` 追加 `legal-dark`（Windows 标题栏） |

## 技术方案

### 配色方案

```css
.theme-legal-dark {
  --background: 225 25% 9%;      /* 深海军蓝黑底色 */
  --foreground: 38 25% 92%;      /* 暖羊皮白文字 */
  --primary: 225 50% 55%;        /* 亮海军蓝主色 */
  --accent-foreground: 38 50% 62%; /* 暖金强调（黄铜印章感） */
  --radius: 0px;                 /* 全局直角 — 法务风格几何特征 */
  --code-bg: 225 30% 6%;         /* 深海蓝底代码块 */
}
```

**设计理念**：
- **海军蓝（H225）**：传递专业、权威、可靠感
- **暖金（H38）**：呼应黄铜印章、铜质铭牌的法务意象
- **直角几何**：区别于其他主题的圆润感，体现法律的严谨

### 自动跟进的机制

以下文件**不需要手动改**（从 `THEME_STYLES` 派生，自动包含新主题）：
- `applyThemeToDOM` 的 class 清理列表（`ALL_THEME_STYLE_CLASSES`）
- `getCachedThemeStyle` 白名单校验
- `tailwind.config.js` 变量映射

### 命名约定

| 位置 | 值 |
|---|---|
| ThemeStyle ID | `legal-dark` |
| CSS class | `.theme-legal-dark` |
| 预览图 | `theme-legal-dark.webp` |
| titlebar key | `'legal-dark'` |

ID 必须以 `-dark` 结尾（明暗判定依赖后缀，见 `applyThemeToDOM`）。

## 验证方式

```bash
bun run dev
# 设置 → 外观 → 特殊风格 → 看到"法务风格"卡片
# 点击 → 主题切换为海军蓝+暖金+直角
# 切回其他主题 → 正常切换
```

## 与上游的差异

`globals.css` 的新增块追加在末尾，几乎不冲突。

`settings.ts` 的 `THEME_STYLES` 是数组追加，合并时保留你的 `legal-dark` 即可。

`AppearanceSettings.tsx` 的 `SPECIAL_STYLES` 数组可能冲突（上游也可能加新主题），合并时两边的新增项都保留。grid 列数按主题总数调整。

## 回滚方式

```bash
git revert 7cfa448c
```
