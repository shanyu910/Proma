# 2026-07-03 应用图标替换

> 将应用图标、托盘图标替换为 Legis 品牌（天平+盾牌法务主题）。

---

## 背景与目的

Legis 品牌定位为法务领域，需要与应用的视觉标识一致。原 Proma 图标是抽象的条纹设计，替换为天平+盾牌的法务主题图标。

## 改动范围

### 替换的文件

| 文件 | 说明 |
|---|---|
| `resources/icon.png` | 主图标（1024×1024），天平+盾牌深蓝色设计 |
| `resources/icon.icns` | macOS 应用包图标 |
| `resources/icon.ico` | Windows 应用图标 |

### 目录重命名

| 原路径 | 新路径 | 原因 |
|---|---|---|
| `resources/proma-logos/` | `resources/legis-logos/` | 品牌一致性 |
| `renderer/assets/bots/proma-logos/` | `renderer/assets/bots/legis-logos/` | 同上 |

### 代码引用同步更新

| 文件 | 改动 |
|---|---|
| `main/tray.ts` | 托盘图标路径 `proma-logos` → `legis-logos` |
| `main/ipc.ts` | 应用图标变体路径 |
| `renderer/.../PromaLogoSettings.tsx` | import 路径 + resourcePath |
| `renderer/.../AppearanceSettings.tsx` | import 路径 |
| `electron-builder.yml` | extraResources 的 `from/to` 路径 |

## 保留的部分

- **品牌变体素材**（`proma-black.png` / `proma-white.png` 等 15 个变体）：保留原 Proma 设计，只改了目录名。这些是给用户的"应用图标切换"功能，不影响品牌主视觉。
- **托盘图标** `iconTemplate*.png`：基于 `icon.svg` 的条纹设计，与应用主图标视觉一致，保持原样。
- **`icon.svg` 源文件**：未改动（Legis 和 Proma 的 svg 源相同，差异在生成后的 png/icns/ico）。

## 技术方案

直接复制 Legis 项目已生成好的 `icon.png` / `icon.icns` / `icon.ico`（MD5 一致验证），复用现有的图标生成链路（`generate-icons.sh`），无需改代码引用——文件名是硬编码约定的。

## 验证方式

```bash
bun run dev
# 检查 macOS Dock 图标是否为天平+盾牌
# 检查窗口图标
# 检查 macOS menubar 托盘图标
```

## 与上游的差异

图标是二进制资源，上游更新时直接用你的版本即可，不会产生 git 文本冲突。

## 回滚方式

```bash
git revert 9d1ef5ac
```
