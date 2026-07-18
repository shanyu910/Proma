# RunWork

**通用场景的 AI Agent 桌面应用。**

RunWork 基于 [Proma](https://github.com/ErlichLiu/Proma) 开源项目改造，把多模型 Chat、通用 Agent、工作区、Skills、MCP 等核心能力整合到一个客户端，适用于各类通用办公与开发场景。支持团队认证体系、统一模型管理和品牌定制。

## 核心能力

- **多模型对话** — 支持 Claude、GPT、DeepSeek、智谱等主流模型，按需切换
- **通用 Agent** — 读写文件、执行命令、调研分析、生成报告，自主完成多步骤任务
- **工作区隔离** — 多项目互不干扰，每个工作区独立的 Skills 和 MCP 配置
- **文档解析** — PDF、Word、Excel 自动提取关键信息
- **本地优先** — 数据存储在本地，隐私可控

## 路线图

- 📌 项目级工作区管理
- 📌 团队知识库共享
- 📌 更多内置 Skills

## 下载安装

前往 [Releases](https://github.com/shanyu910/Proma/releases) 下载最新版本。

### macOS 安装

下载 `.dmg` 文件并安装后，如果打开时提示 **"已损坏，无法打开"**，打开终端执行：

```bash
sudo xattr -cr /Applications/RunWork.app
```

输入 Mac 密码后，重新打开 RunWork 即可。

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
