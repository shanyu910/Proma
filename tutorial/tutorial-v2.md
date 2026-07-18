# 欢迎使用 RunWork

RunWork 是一个本地优先的 AI 桌面应用，把多模型 Chat、通用 Agent、工作区、Skills、MCP 和远程机器人能力放在同一个客户端里。

简单问题用 Chat，复杂任务交给 Agent，数据和配置尽量留在本地。

---

## 快速开始

### 1. 配置渠道

进入 **设置 → 渠道**，添加至少一个 AI 供应商渠道，填写 Base URL、API Key 和模型列表。

- **Chat 模式**：支持 OpenAI、Anthropic、Google 或 OpenAI 兼容协议的渠道。
- **Agent 模式**：需要 Anthropic 协议或 Anthropic 兼容协议渠道（如 Anthropic、DeepSeek、Kimi 等）。

### 2. 选择模式

- **Chat**：日常问答、翻译、润色、轻量代码讨论、附件解析、多模型对比。
- **Agent**：修改/创建本地文件、调研、编写报告、多步骤任务、使用 MCP/Skills/Shell/Git 等外部上下文。

### 3. 开始使用

在 Chat 里直接对话，或在 Agent 里描述任务让 Agent 自主完成。Agent 支持权限确认、计划模式、后台任务。

---

## 核心概念

### 工作区

Agent 模式按工作区隔离，每个工作区有独立的 MCP Server 配置、Skills 和文件目录。适合把不同项目的上下文彻底分开。

### Skills & MCP

每个工作区可以独立配置 Skills 和 MCP Server，沉淀可复用的能力。Agent 模式下可以通过斜杠命令调用 Skills。

### 本地存储

所有会话、工作区、附件、配置默认存储在 `~/.runwork/`，使用 JSON / JSONL 文件组织，不依赖本地数据库，文件可移植。

---

## 需要帮助？

- **设置 → 关于**：查看版本信息和更新
- **GitHub Issues**：反馈问题或建议

祝你使用愉快！
