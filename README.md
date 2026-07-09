# Legis

**面向法律行业的 AI Agent 桌面应用。**

Legis 基于 [Proma](https://github.com/ErlichLiu/Proma) 开源项目改造，专为律师和法律从业者打造。继承 Proma 的多模型 Chat、通用 Agent、工作区、Skills 等核心能力，在此基础上增加了法律行业所需的认证体系、模型管理和品牌定制。

## 核心能力

- **AI 对话** — 支持多家大模型，合同审查、法律研究、文书起草
- **Agent 工作区** — 自动化处理复杂法律任务
- **本地优先** — 数据存储在本地，隐私可控

## 路线图

- 📌 律师专属项目管理
- 📌 个人知识库（面向律师）
- 📌 数据脱敏服务

## 下载安装

前往 [Releases](https://github.com/shanyu910/Proma/releases) 下载最新版本。

### macOS 安装

下载 `.dmg` 文件并安装后，如果打开时提示 **"已损坏，无法打开"**，打开终端执行：

```bash
sudo xattr -cr /Applications/Legis.app
```

输入 Mac 密码后，重新打开 Legis 即可。

### Windows 安装

下载 `.exe` 文件安装。如果 SmartScreen 提示"已保护你的电脑"，点击 **"更多信息" → "仍要运行"**。

## 开发

```bash
# 安装依赖
bun install

# 开发模式
bun run dev

# 构建
bun run electron:build
```

详见 [AGENTS.md](./AGENTS.md)。

## 致谢

本项目基于 [Proma](https://github.com/ErlichLiu/Proma) 开源项目，感谢原作者 [@ErlichLiu](https://github.com/ErlichLiu) 的贡献。

## 开源协议

[AGPL-3.0](./LICENSE)
