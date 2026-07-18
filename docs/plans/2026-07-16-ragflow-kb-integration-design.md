# RAGFlow 知识库集成到 Proma 设计方案

> **状态**: 已确认所有架构决策，待转实施计划
> **日期**: 2026-07-16
> **范围**: 将 RAGFlow 核心知识库能力拆成独立云端服务，通过 MCP 集成进 Proma 桌面端 Agent，面向律师办案团队。

---

## 0. 背景与目标

Proma 是基于 Claude Agent SDK 的 Electron 桌面端 Agent，面向团队（律师办案团队）使用。需要为团队提供**个人 + 团队共享**的知识库能力，包括基础 RAG 检索和 Agentic 深度研究。

本方案将 RAGFlow 仓库中的核心知识库能力拆解为独立的云端微服务，与 Proma 已有的解析/脱敏服务、以及新建的项目管理服务协同工作，通过 MCP 协议让 Proma 的 Claude Agent 调用。

**核心理念**：每个服务单独存在、各司其职；通过 SSO 统一身份、通过 MCP 统一给 Agent 用、通过 REST + WebView 给人用。

---

## 1. 决策清单（全部已确认）

| # | 决策点 | 选择 | 确认依据 |
|---|---|---|---|
| 1 | 能力范围 | 基础 RAG + Agentic 深度研究 | 团队要深度研究能力 |
| 2 | 图谱去留 | 全留 + 接通（graphrag + knowlege_compile） | 法律文档强结构、强关系场景 |
| 3 | 集成协议 | MCP | Proma 是 Claude Agent SDK 原生，`agent-orchestrator.ts:1365` 直接把 `mcpServers` 传进 `query()`，零代码改动消费 |
| 4 | 存储引擎 | Infinity + PostgreSQL + MinIO | 团队有 Infinity 运维经验 |
| 5 | Embedding 模型 | 本地 BGE（自包含，无外部依赖） | 团队服务器自包含 |
| 6 | LLM/rerank 管理 | 全局单一模型，服务端配，跟用户无关 | 简化管理 |
| 7 | 前端方案 | 抽 RAGFlow 知识库前端 + 主题桥接 + WebView 嵌入 | RAGFlow 前端已用 shadcn/Tailwind，与 Proma 同栈 |
| 8 | 认证 | SSO 共享密钥（改 RunWork-Server 一处） | 用户一次登录，token 自动复用 |
| 9 | Agent 调用模式 | 手动触发，界面显式选库 + 选模式 | 团队场景需可控、可审计 |
| 10 | 检索模式 | 4 档：纯检索 / 标准 / 深度 / 极致 | 对应 low/medium/high/ultra |
| 11 | 参数注入 | 会话级预设参数 | 可控且不复杂 |
| 12 | 实施节奏 | 一次性全上含图谱 | — |
| 13 | 文件解析 | 用 Proma 已有的 PaddleOCR 解析服务，砍掉 deepdoc | 底层同源（PaddleOCR），避免冗余 |
| 14 | 文件脱敏 | 用 Proma 已有的脱敏服务，作为解析后预处理 | 律师场景刚需 |
| 15 | 模型配置粒度 | Embedding 知识库级锁定；LLM 全局单一 | 向量库物理约束 + 管理简化 |
| 16 | 项目管理范围 | 项目 + 任务管理 | 案子（项目）+ 任务分配 |
| 17 | 项目与知识库关系 | 独立不绑定，在 Agent 对话层关联 | 两个服务解耦，各自演进 |
| 18 | 账号同步 | 实时查 RunWork-Server + 轻量缓存（TTL 5min）| 单一数据源，知识库服务不存用户表，砍掉 RAGFlow 的 User/Tenant/UserTenant |

---

## 2. 整体架构

```
┌─ Proma (Electron, shadcn/Tailwind) ─────────────────────────────┐
│                                                                 │
│  侧栏:                                                           │
│   ├─ 💬 Agent Chat（原生，已有）                                  │
│   ├─ 📚 知识库（webview 嵌入知识库前端）                          │
│   ├─ 📁 项目（webview 嵌入项目管理前端）   ← 新增入口             │
│   └─ ⚙️ 设置                                                     │
│                                                                 │
│  Agent 对话输入框（手动触发）:                                    │
│   [📁 张三诉李四案]  [📚 合同模板库·深度]  分析这份合同风险点      │
│        ↑                ↑                                       │
│   项目上下文(MCP)   知识库上下文(MCP，预设kb_ids+模式)            │
│                                                                 │
│  → Claude 同时调 project.* 和 ragflow.* 工具                     │
└───────────┬───────────────────────────────────┬─────────────────┘
            │ MCP over HTTP (Bearer SSO token)  │
   ┌────────┴────────┐                 ┌─────────┴─────────┐
   ▼                 ▼                 ▼                   ▼
┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 知识库服务 │  │ 项目管理服务   │  │ 解析服务      │  │ 脱敏服务      │
│ (Python)  │  │ (新建)        │  │ (已有)        │  │ (已有)        │
│           │  │              │  │ PaddleOCR    │  │              │
│ 存储/检索  │  │ 项目/任务/成员 │  │ 扫描件→md    │  │ md→脱敏md    │
│ 图谱/harness│  │              │  │              │  │              │
│ PG+Infinity│  │ 独立 PG       │  │ (无状态)      │  │ (无状态)      │
└─────┬─────┘  └──────────────┘  └──────────────┘  └──────────────┘
      │ 知识库在摄入时编排调用解析+脱敏
      └────────────────────────────────────────────► (HTTP)

   ← 认证: 所有服务共用 SSO token（RunWork-Server 签发，共享密钥验证）
   ← 账号: 知识库/项目服务实时查 RunWork-Server 拿团队/角色（单一数据源，见 §7）→
```

### 五个独立服务的职责

| 服务 | 性质 | 数据库 | 给 Agent（MCP） | 给人（REST + WebView） |
|---|---|---|---|---|
| 知识库服务 | 核心，有状态 | PG + Infinity + MinIO | search/deep_research | KB 管理、检索测试 |
| 项目管理服务 | 核心，有状态 | 独立 PG | project.* 工具 | 案子/任务管理 |
| 解析服务 | 无状态 | 无 | — | 被知识库调 |
| 脱敏服务 | 无状态 | 无 | — | 被知识库调 |
| RunWork-Server | 已有 | 已有 | — | SSO 签发 + 账号权威源（团队/角色实时查询）|

---

## 3. 从 RAGFlow 抽取的边界

### 3.1 保留（~1.1 万行核心）

| 层 | 来源 | 说明 |
|---|---|---|
| Agentic Harness | `rag/advanced_rag/harness/`（25 文件） | 4 级推理引擎。⚠️ 需重构 `RAGTools` → `SearchToolProvider` Protocol，切 4 条外部耦合 |
| 检索核心 | `rag/nlp/search.py` `query.py` `rag_tokenizer.py` + `common/doc_store/` infinity 部分 | Dealer 混合检索 |
| LLM 封装 | `rag/llm/embedding_model.py` `chat_model.py` `rerank_model.py` `model_meta.py` | 瘦身到目标 provider |
| 摄入管道 | `rag/svr/task_executor.py` 核心函数 | 解析阶段改为调外部服务 |
| 分块器 | `rag/app/naive.py` 的 `PlainParser` 分块逻辑 | 只保留接收 md 文本的分块逻辑，删除文件读取部分 |
| 知识图谱 | `rag/graphrag/`（6569 行） | NER 抽取、Leiden 社区发现、图谱检索 |
| 知识编译 | `rag/advanced_rag/knowlege_compile/`（9543 行） | RAPTOR、思维导图、wiki、结构化 |
| 胶水层 | `rag/advanced_rag/agentic_rag.py` 的 `RAGTools` | 重构为 Protocol |

### 3.2 砍掉

| 模块 | 行数 | 原因 |
|---|---|---|
| `deepdoc/` 全部 | 15358 | 用 Proma 已有的 PaddleOCR 解析服务替代（底层同源） |
| `internal/`（Go 全部） | — | Python 已有完整实现 |
| `web/` 非知识库部分 | ~16 万行 | agent/chat/search/skills/memory/admin 等 |
| `agent/`（Canvas/Workflow） | — | Proma 已有 Agent 运行时 |
| ES/OpenSearch/OceanBase 引擎 | — | 只留 Infinity |
| office_oxide/pdfium/tika 原生库 | — | deepdoc 砍掉后不再需要，**部署门槛放宽** |

### 3.3 Harness 抽取的真实工程量（修正）

原 RAGFlow 方案说"几乎零修改"是错的。真实情况：

**4 条外部耦合尾巴必须先切断**：
- `tools/search.py` → `api/db/services/dialog_service.use_sql`（跨到 api 层）：下沉到检索核心
- `tools/search.py` → `common.settings` + `common.misc_utils`：抽成 harness 自己的 config
- `planner.py` → `rag.advanced_rag.agentic_rag_graph._snip`：搬进 harness
- `planner.py` → `rag.prompts.generator.kb_prompt`：随 harness 一起搬

**重构**：`SearchToolProvider` Protocol 是待建目标，不是现状。现状胶水是 `RAGTools` 普通类。第一步是抽象成 Protocol。

**过时描述纠正**：原方案说"harness 依赖 langgraph"——代码里 `grep langgraph` 零结果，已无此依赖。

### 3.4 Harness 的 5 个占位工具要接通

harness 的 13 个工具里，5 个当前是占位实现（fallback 到 hybrid_search），必须接通真后端：

| 工具 | 现状 | 接通到 |
|---|---|---|
| `graph_explore` | TODO 占位 | graphrag 图遍历 |
| `toc_navigate` | TODO 占位 | knowlege_compile structure 产物 |
| `mindmap_navigate` | TODO 占位 | knowlege_compile mindmap 产物 |
| `wiki_query` | TODO 占位 | knowlege_compile wiki 产物 |
| `page_index_navigate` | TODO 占位 | page index 产物 |

---

## 4. 知识库服务设计

### 4.1 模块划分

```
kb-service/                         ← 抽出的独立项目
├── engine/                         ← 从 RAGFlow 抽的核心（被动库）
│   ├── harness/                    ← Agentic Harness（25 文件，已切耦 + Protocol 化）
│   ├── search/                     ← Dealer 混合检索 + Infinity 适配
│   ├── llm/                        ← Embedding/Chat/Rerank（瘦身版）
│   ├── chunker/                    ← naive.py 的 PlainParser 分块逻辑
│   ├── graphrag/                   ← 知识图谱
│   ├── knowlege_compile/           ← 知识编译
│   ├── store/                      ← DocStore 抽象 + Infinity 实现
│   └── search_tool_provider.py     ← SearchToolProvider Protocol + 实现
│
├── server/                         ← 服务层（主动应用）
│   ├── auth/                       ← SSO JWT 验证（共享密钥）
│   ├── rest/                       ← /api REST 路由（KB CRUD/上传/检索测试）
│   ├── mcp/                        ← /mcp MCP Server（fastmcp）
│   │   ├── tools.py                ← search_knowledge / deep_research
│   │   └── resources.py            ← rag://kb/{id}/chunks/{cid}
│   ├── services/                   ← KB/文档 业务逻辑
│   ├── ingestion/                  ← 编排：调解析→脱敏→分块→入库→图谱
│   └── models/                     ← Peewee 模型（复用 RAGFlow 表结构）
│
├── web/                            ← 抽 RAGFlow 知识库前端（精简版）
│   └── (见 §6 前端方案)
│
└── docker-compose.yml
```

### 4.2 MCP 工具设计

```
工具 1: search_knowledge   （纯检索模式用）
  入参: { query: string,          ← Claude 填
          kb_ids: string[],        ← 预设（用户在界面选的库）
          top_k?: number }
  返回: chunks 数组（带 doc_id/page/score）
  作用: 快速事实查询

工具 2: deep_research       （标准/深度/极致模式用）
  入参: { question: string,        ← Claude 填
          kb_ids: string[],         ← 预设
          reasoning_level: 'medium'|'high'|'ultra' }  ← 预设
  返回: 综合分析答案（带引用）
  作用: 复杂问题的多轮研究（云端 harness 内部编排）

工具 3: ingest_document     （Web 管理用）
工具 4: list_knowledge_bases（界面加载 KB 列表用）
工具 5: create_knowledge_base（Web 管理用）
```

**关键设计**：`deep_research` 是黑盒工具——Proma 的 Claude 只管"决定要不要调"，云端 harness 自己跑完整套多 Agent 循环返回综合答案。不让 Proma Claude 编排 RAGFlow 内部 Agent，避免嵌套 Agent 职责混乱。

**预设参数**：`kb_ids` 和 `reasoning_level` 是用户在界面选的，Claude 调工具时用预设值，不能自己改。保证用户手动选择不被覆盖。

### 4.3 摄入流程（编排解析 + 脱敏）

```
用户上传文件
  → kb-api 存 MinIO → 创建 document 记录（status=parsing）
  → 推入任务队列
  → kb-worker 拿到任务:
    ① 调解析服务: POST {PARSER_SERVICE_URL} → 返回 markdown
    ② 调脱敏服务: POST {DESENSITIZE_SERVICE_URL} → 返回脱敏 md
    ③ naive.py PlainParser 分块: md → sections → chunks
    ④ embedding（本地 BGE）→ 向量
    ⑤ 入 Infinity
    ⑥ 可选: 知识编译（RAPTOR/GraphRAG/MindMap，按知识库级开关）
    ⑦ 更新 document.status = done
```

配置：
```python
PARSER_SERVICE_URL = "http://parser-service/parse"
DESENSITIZE_SERVICE_URL = "http://desensitize-service/mask"
```

### 4.4 模型配置

| 模型类型 | 配置粒度 | 说明 |
|---|---|---|
| Embedding | 知识库级，建库时锁定 | `knowledgebase.embd_id`，建库后不能改（向量库物理约束） |
| LLM（深度研究/图谱/rerank） | 全局单一，服务端配 | 跟用户无关，管理员在服务端配 |

---

## 5. 项目管理服务设计（新建）

### 5.1 数据模型

```sql
-- 项目（案子）
CREATE TABLE projects (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    case_number VARCHAR(100),          -- 案号
    team_id VARCHAR(32) NOT NULL,      -- 属于哪个团队
    status VARCHAR(32) DEFAULT 'active', -- active/closed/archived
    created_by VARCHAR(32) NOT NULL,
    created_at DATETIME DEFAULT NOW()
);

-- 项目成员
CREATE TABLE project_members (
    id VARCHAR(32) PRIMARY KEY,
    project_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    role VARCHAR(32) NOT NULL,         -- lead/associate/assistant
    joined_at DATETIME DEFAULT NOW()
);

-- 任务
CREATE TABLE tasks (
    id VARCHAR(32) PRIMARY KEY,
    project_id VARCHAR(32) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    assignee_id VARCHAR(32),           -- 负责人
    status VARCHAR(32) DEFAULT 'todo', -- todo/doing/done
    due_date DATETIME,
    created_by VARCHAR(32) NOT NULL,
    created_at DATETIME DEFAULT NOW()
);
```

### 5.2 与知识库的关系：独立不绑定

项目和知识库**在数据层不绑定**。它们的关联发生在 **Agent 对话层**——用户在输入框同时带上项目上下文和知识库上下文，Claude 同时调 `project.*` 和 `ragflow.*` 工具。

### 5.3 MCP 工具

```
project.list_projects      列我参与的案子
project.get_project        案子详情
project.list_tasks         列案子的任务
project.create_task        建任务
project.update_task        更新任务状态
project.list_members       案子成员
```

---

## 6. 前端方案

### 6.1 知识库前端：抽 RAGFlow + 主题桥接 + WebView 嵌入

**技术栈验证**：RAGFlow 前端已用 shadcn/Tailwind/Radix（与 Proma 同栈），不是 antd。全 web/ 直接 import antd 次数为 0，用 shadcn 组件 1151 次。

```
从 RAGFlow web/ 抽出精简版:
保留（~250 文件, ~3-4 万行）:
  pages/datasets/        知识库列表（612 行）
  pages/dataset/         知识库详情（13901 行，含图谱/检索测试/配置）
  pages/chunk/           chunk 编辑（2577 行）
  pages/document-viewer/ 文档预览
  pages/files/           文件管理
  pages/login-next/      重写为 SSO 跳转
  components/ui/         shadcn 组件（按需）
  services/              API 层（改 baseURL + 认证）

砍掉（~1000 文件, ~16 万行）:
  pages/agent/           Canvas 工作流（37685 行）
  pages/next-chats/      Chat（3637 行）
  pages/next-search*/    搜索（3539 行）
  pages/skills/          技能（6170 行）
  pages/memory/          记忆（1485 行）
  pages/admin/           管理后台（5446 行）
  pages/user-setting/    用户设置（模型配置部分抠出来留）
  ...其余
```

**改动清单**:
| 改动 | 文件 | 工作量 |
|---|---|---|
| 删不用的页面 | `pages/agent/` 等 ~16 万行 | 1 天 |
| 改认证层 | `utils/request.ts` + `login-next/` | 2-3 天 |
| 对齐 API | `services/*.ts` 的 baseURL | 0.5 天 |
| 主题桥接 | 新建 `theme/proma-bridge.css`（~30 行变量映射） | 1-2 天 |

**主题桥接**：RAGFlow 用自定义语义变量（`--background-card` 等），Proma 用标准 shadcn HSL 变量（`--card` 等）。建一个映射层让 RAGFlow 的 className 自动套 Proma 配色，不用动业务代码。

**WebView 嵌入 + SSO**：
```
Proma webview 标签:
  src="https://kb.your-domain.com/app"
  preload="./kb-preload.js"

kb-preload.js:
  ① 注入 SSO token 到 localStorage
  ② 监听 Proma 主题变化 → 同步 theme class
```

### 6.2 项目管理前端

用 shadcn/Tailwind 新写（复用 RAGFlow 前端的组件库），WebView 嵌入。页面：案子列表、案子详情（任务看板）、成员管理。

---

## 7. 认证与账号同步

认证和账号同步是两个独立的层，必须分开处理：

| 层 | 解决的问题 | 方案 |
|---|---|---|
| **认证（Authentication）** | "这个 token 合法吗 / 你是谁" | SSO 共享密钥 |
| **账号同步（Provisioning）** | "你的团队/角色/权限数据在哪" | 实时查 RunWork-Server + 轻量缓存 |

### 7.1 认证层：SSO 共享密钥

```
RunWork-Server（已有，改一处配置）
  /auth/login → 用 SHARED_SECRET 签发 JWT
  JWT payload: { user_id, email, active_tenant_id, exp }
       │
       │  共享 SHARED_SECRET
       ▼
知识库服务 / 项目管理服务（新建）
  收到请求 → 用 SHARED_SECRET 验 JWT → 信任 user_id
  不需要再登录，不需要 token 交换
```

**用户视角**：登录 RunWork（照旧）→ 打开 Agent 会话或知识库管理面板 → 自动可用。全程一次登录，零额外配置。

**JWT 过期处理**：RunWork 已有 token 续签机制，复用。

### 7.2 账号同步层：实时查 RunWork-Server

**问题本质**：SSO 只解决了"user_id 是谁"，但知识库服务的数据库里，需要知道这个 user_id 属于哪些团队、什么角色、能访问哪些知识库。RAGFlow 原生有 `User/Tenant/UserTenant` 三张表管这些，但和 RunWork-Server 的账号数据会双份冲突。

**方案：单一数据源 + 实时查询**

知识库服务**不存用户表**，每次请求时用 JWT 里的 user_id 去 RunWork-Server 查团队和角色，带短时缓存。

```
RunWork 桌面端（带 JWT: user_id=zhangsan）
    │
    ▼
知识库服务收到请求
    │
    ① 验 JWT（共享密钥）→ 拿到 user_id
    │
    ② 查本地缓存: "zhangsan 的团队信息缓存了吗？"
       ├─ 有 + 没过期 → 直接用（~0ms）
       └─ 无/过期 → 调 RunWork-Server
    │
    ③ 调 RunWork-Server 内部接口（带服务间密钥）
    │
    ④ 缓存结果（TTL 5 分钟）
    │
    ⑤ 用团队信息校验知识库权限
```

**RunWork-Server 新增内部接口**（服务间调用，不走用户 JWT）：

```
GET /internal/users/{user_id}/tenants
  Header: X-Internal-Secret: {INTERNAL_SECRET}
  返回: {
    "tenants": [
      { "tenant_id": "team_law1", "name": "法务一部", "role": "owner" },
      { "tenant_id": "team_law2", "name": "法务二部", "role": "viewer" }
    ]
  }

GET /internal/tenants/{tenant_id}/members
  Header: X-Internal-Secret: {INTERNAL_SECRET}
  返回: 成员列表（项目管理/权限校验用）
```

### 7.3 和 RAGFlow 原有账号模型的关系

RAGFlow 的 `Tenant` 表混合了"团队信息"和"模型配置"两类字段，需要拆分：

```
RAGFlow 原 Tenant 表:
  id, name                         ← 团队信息（改为从 RunWork-Server 实时查）
  llm_id, embd_id, rerank_id ...  ← 模型配置（全局单一，砍掉）

改造后:
  知识库服务不再需要 User / Tenant / UserTenant 三张表
  用户/团队/角色 → 实时从 RunWork-Server 查（单一数据源）
  模型配置 → 全局环境变量/配置文件
```

**本地只保留团队名称映射**（可选，用于知识库列表显示团队名而不用每次查 RunWork-Server）：

```
本地表 kb_tenant_names（轻量缓存，非权威数据）:
  tenant_id (PK), name, updated_at
  ← 从 RunWork-Server 的返回里顺带刷新

Knowledgebase 表直接引用 RunWork-Server 的 tenant_id:
  Knowledgebase.tenant_id = "team_law1"   ← RunWork-Server 的团队 ID
```

### 7.4 权限校验流程（完整）

```
用户 zhangsan 调 search_knowledge(kb_ids=["kb_abc"]):

① 验 JWT → user_id=zhangsan
② 查 RunWork-Server（带缓存）→ zhangsan 属于 [team_law1(owner), team_law2(viewer)]
③ 查知识库 kb_abc:
   - kb_abc.tenant_id = "team_law1"
   - kb_abc.permission = "team"
④ 校验: team_law1 在 zhangsan 的团队列表里？ ✅
   - role=owner >= required_role? ✅
⑤ 允许检索
```

**三种同步方案对比**（已选定实时查询）：

| | 实时查 RunWork-Server | JWT 携带权限 | 定期同步副本 |
|---|---|---|---|
| 单一数据源 | ✅ 是 | ✅ 是 | ❌ 双份 |
| 改角色生效 | ✅ 立即（缓存过期后）| ⚠️ 等 token 刷新 | ❌ 等下次同步 |
| 额外查询 | ⚠️ 有（可缓存） | ✅ 无 | ✅ 无 |
| 实现复杂度 | 低 | 低 | 高 |
| **选定** | ✅ | | |

---

## 8. 多租户权限

复用 RAGFlow 的 `User/Tenant/UserTenant` 模型：

```
个人知识库: tenant_id=NULL, permission="me"，只有创建者可见
团队知识库: 绑定 tenant_id, permission="team"，团队内按角色访问

角色: owner / admin / editor / viewer
  viewer 可检索不可编辑

项目同理: project.team_id 决定哪个团队可见
```

**向量索引隔离**：Infinity 按 tenant_id 字段过滤，不物理分库。

---

## 9. Proma 侧改动（汇总）

| 改动 | 文件 | 工作量 |
|---|---|---|
| 侧栏加 📚 知识库、📁 项目入口 | 侧栏组件 + 路由 | 小 |
| 知识库管理 WebView 标签页 | 新建 KBView.tsx | 小 |
| 项目管理 WebView 标签页 | 新建 ProjectView.tsx | 小 |
| preload 脚本注入 SSO token | kb-preload.js / project-preload.js | 小 |
| 输入框加 📚 知识库选择器 | 新建 KnowledgeBasePicker.tsx | 中 |
| 输入框加 📁 项目选择器 | 新建 ProjectPicker.tsx | 中 |
| 选库后 chip 显示 | ChatInput | 小 |
| `buildMcpServers()` 动态注入 SSO token | `agent-orchestrator.ts`（~15 行） | 小 |
| 发消息带 knowledgeBaseContext + projectContext | agent.ts 类型 + AgentView.tsx | 小 |
| orchestrator 注入预设参数到提示词 | `agent-orchestrator.ts`（~20 行） | 小 |
| 加载 KB/项目列表的 REST 调用 | 新建 kb-api.ts / project-api.ts | 小 |

**总原则**：不碰 Claude SDK 核心，不碰 Agent loop 逻辑，复用现有 `#mcp:` mention 机制和 `buildMcpServers`。

---

## 10. 部署

### 10.1 服务清单（docker-compose）

```
云端服务器（Linux，不需要 x86 原生库，因为砍了 deepdoc）:
├── nginx              反代 + HTTPS（/api /mcp /app 多域名/路径）
├── postgres           知识库元数据 + 权限 + 项目管理数据
├── infinity           向量 + 全文索引
├── minio              原始文件 + 图谱 networkx 序列化产物
├── kb-api             知识库 REST + MCP Server
├── kb-worker          摄入 worker（异步跑解析编排 + 图谱构建）
├── project-api        项目管理 REST + MCP Server
├── parser-service     解析服务（已有，PaddleOCR）
└── desensitize-service 脱敏服务（已有）

已有（需改）:
├── runwork-server       SSO 签发（改一处共享密钥配置）
│                      + 新增 2 个内部接口（/internal/users/{id}/tenants 等）
└── agentskill         模型/Skill 分发（不动）

任务队列: 用 PG 做队列（FOR UPDATE SKIP LOCKED 模式），不引入额外组件。
         见 §14 待定项说明。

账号同步: 知识库/项目服务不存用户表，实时查 RunWork-Server（见 §7.2）。
```

### 10.2 资源估算

| 组件 | 内存 |
|---|---|
| Infinity | ~1-2 GB |
| PostgreSQL | ~500 MB |
| MinIO | ~300 MB |
| kb-api + kb-worker | ~1-2 GB（含 BGE embedding 模型） |
| project-api | ~300 MB |
| BGE 模型文件 | ~2-3 GB 磁盘 |
| **合计** | **~4-6 GB 内存 + 50GB+ 磁盘** |

建议配置：4 核 8G 内存、100GB 磁盘的 Linux 服务器起步。

### 10.3 部署门槛修正

砍掉 deepdoc 后，**不再需要 office_oxide/pdfium/tika 原生库**（那些只有 Linux x86 预编译版）。RAG 服务部署门槛从"必须 Linux x86"放宽到"只要能跑 Python"。解析能力由外部 PaddleOCR 服务提供。

---

## 11. 检索模式映射

```
界面选项      →  reasoning_level  →  harness 行为              →  耗时
────────────────────────────────────────────────────────────────────
纯检索        →  search            →  search_knowledge 工具       →  ~2s
                                    （不进 harness，返回 chunks）
标准          →  medium            →  decompose_and_search        →  ~15s
                                    （分解 + 充分性检查）
深度          →  high              →  agentic_research            →  ~30s
                                    （2 Agent 并行 + 7 工具）
极致          →  ultra             →  deep_research               →  ~2min
                                    （3 Agent + 13 工具 + 图谱）
```

**纯检索**调 `search_knowledge`，其余三档调 `deep_research`（harness 内部编排）。

---

## 12. 实施计划（~10 周，含图谱）

```
Phase 1: 抽引擎核心（~2 周）
├── 抽 harness + 切 4 条耦合 + RAGTools→Protocol 重构
├── 抽检索核心 + Infinity 适配
├── 抽 LLM 封装（瘦身）
├── 抽 naive 分块器（只留 PlainParser）
└── 验证: 纯 Python "上传→解析→分块→检索→回答" 闭环

Phase 2: 抽图谱 + 接通工具（~2 周）
├── 抽 graphrag（NER/Leiden/社区报告/检索）
├── 抽 knowlege_compile（RAPTOR/mindmap/wiki/structure）
├── 接通 harness 5 个占位工具到真后端
└── 验证: ultra 模式 13 工具全部走真后端

Phase 3: 服务层（~2 周）
├── SSO JWT 认证（共享密钥）
├── REST API（KB CRUD / 文档上传 / 检索测试）
├── MCP Server（fastmcp，5 个工具）
├── 摄入 worker（编排解析+脱敏+图谱构建）
└── 验证: Proma 加 .mcp.json 配置，对话里能检索

Phase 4: 项目管理服务（~1.5 周）
├── 数据模型 + REST API
├── MCP Server（project.* 工具）
├── 前端（shadcn，WebView 嵌入）
└── 验证: Proma 对话里能查项目任务

Phase 5: 知识库前端 + 部署（~2 周）
├── 抽 RAGFlow 知识库前端（删 16 万行）
├── 主题桥接 + SSO 适配 + API 对齐
├── docker-compose（全部服务）
├── Proma WebView 嵌入 + preload
└── 验证: 团队成员浏览器/Proma 内嵌都能管 KB

Phase 6: Proma 侧集成 + 联调（~0.5 周）
├── 输入框知识库/项目选择器
├── buildMcpServers 动态 token 注入
├── 会话级预设参数注入
└── 端到端验证
```

---

## 13. 用户使用流程

### 13.1 Agent 对话用知识库（手动触发）

```
① 用户点输入框 📚 图标
   → Proma 调知识库服务 GET /api/kbs（带 SSO token）
   → 返回 [个人 KB] + [团队 KB（按 active_tenant 过滤）]
   → 用户选「合同模板库」+ 模式「深度」
   → Proma 存 sessionKBContext = { kb_ids, reasoning_level }

② 用户发消息
   → sendMessage({ mentionedMcpServers:['ragflow'], knowledgeBaseContext })
   → orchestrator 注入预设参数到 Claude 指令

③ Claude 调 deep_research（kb_ids/reasoning_level 已预设）
   → 云端验 JWT → 查权限 → 跑 high 模式 harness 循环
   → 返回带引用的深度分析
```

### 13.2 管理知识库（管理员）

```
管理员浏览器/WebView 打开知识库管理面板
→ SSO 已登录
→ 建知识库（选 embedding 模型，锁定）
→ 上传 PDF → worker 编排: 解析→脱敏→分块→图谱构建
→ 进度实时显示
→ 成员 Agent 自动能检索（tenant 权限通过）
```

### 13.3 项目 + 知识库在对话里协作

```
用户输入框:
  [📁 张三诉李四案]  [📚 合同模板库·深度]
  "分析这个案子的合同风险，对比模板标准条款"

Claude 同时调:
  project.list_tasks(project_id=案A)  → 了解案件任务/进度
  ragflow.deep_research(...)          → 检索标准条款
  → 综合两者给出分析
```

---

## 14. 待实施时确定的技术细节（不影响架构）

| 项 | 说明 |
|---|---|
| 图谱增量同步 | RAGFlow 已有 `phase_markers` 机制，复用 |
| 脱敏检索匹配 | 单向脱敏会导致 query 人名匹配不上，实施时定（建议双向脱敏成同套占位符）|
| 任务队列选型 | PG 队列（FOR UPDATE SKIP LOCKED）或 Redis，实施时定 |
| 模型配置 UI | 从 RAGFlow `user-setting/` 抠出模型配置部分单独留 |
| 监控/日志 | 团队小规模先不要，MVP 后加 |
| 数据配额 | 先不限 |

---

## 附录 A: 关键代码校验结论

本方案基于对 RAGFlow 和 Proma 实际代码的校验，关键结论：

1. **harness 25 个文件**（非原方案说的 29）
2. **harness 不依赖 langgraph**（原方案描述过时）
3. **SearchToolProvider Protocol 是待建目标，不是现状**——现状是 `RAGTools` 普通类
4. **harness 有 4 条外部耦合**要切（use_sql / settings / _snip / kb_prompt）
5. **RAGFlow 前端是 shadcn/Tailwind，不是 antd**（package.json 里的 antd 是历史残留）
6. **Proma 是 Claude Agent SDK 原生**，MCP 是它的工具扩展原生通道
7. **deepdoc 是完整解析服务**（含 DLA/OCR/TSR），但底层 PaddleOCR 与 Proma 已有服务同源，砍掉避免冗余
8. **存储引擎实际有四种**（ES/Infinity/OpenSearch/OceanBase），非原方案说的三种

## 附录 B: 原方案描述与代码现实的差异

| 原方案描述 | 代码现实 | 处理 |
|---|---|---|
| "harness 29 个文件" | 25 个 | 以代码为准 |
| "仅依赖 langgraph" | 不依赖 langgraph | 已修正 |
| "SearchToolProvider Protocol" | 不存在，是 RAGTools 类 | 重构为 Protocol |
| "几乎零修改搬走" | 有 4 条耦合要切 | 工程量 +2-3 天 |
| "4 周" | 实际 ~8-10 周 | 含图谱 + 服务层 + 前端 |
| "deepdoc 砍掉是可选优化" | 用 Proma PaddleOCR 服务替代，必须砍 | 部署门槛放宽 |
| "前端用 antd，要全新写" | 前端是 shadcn，与 Proma 同栈 | 抽取 + 主题桥接 |
