# Legis-Server 余额数据不一致问题 — 修复需求

## 问题描述

Legis-Server 的 `/auth/me/model-usage` 和 `/auth/me/model-config` 接口返回的余额，与用户在 AgentSkill 网站上实际看到的余额**不一致**，差了 $1。

## 具体数据对比

| 数据源 | 总额 (quotaUsd) | 已用 (usedUsd) | 余额 (balanceUsd) |
|---|---|---|---|
| **AgentSkill 网站**（用户实际看到的） | ?（推测 $6） | ? | **$5.96** |
| **Legis-Server 接口返回** | $5.00 | $0.04 | $4.96 |

差额：$5.96 - $4.96 = **$1.00**

## 问题分析

### 1. quotaUsd（总额）可能没反映真实充值

接口返回 `quotaUsd: 5`，但如果用户实际充值了 $6（或 AgentSkill 有赠送 $1），那 `quotaUsd` 应该是 $6，而不是 $5。

**需要确认**：`quotaUsd` 这个值是怎么来的？
- 是管理员创建用户时手动设的固定值（如 $5）？
- 还是从 AgentSkill 同步过来的实际充值总额？

如果是手动设的固定值，那用户后续在 AgentSkill 充值后，`quotaUsd` 不会更新——这就是 $1 差额的原因。

### 2. balanceUsd 是算出来的，不是查出来的

当前 `balanceUsd = quotaUsd - usedUsd = 5 - 0.04 = 4.96`。

但 AgentSkill 网站显示的余额是 $5.96，说明 AgentSkill 那边的真实余额（可能含充值赠送等）比 Legis-Server 记录的多 $1。

### 3. usedUsd 似乎是准确的

`usedUsd: 0.04` —— 这个值看起来是对的（和 AgentSkill 的消费记录吻合）。问题出在 `quotaUsd`（总额）没有同步真实充值金额。

## 需要修复的点

### 核心问题：`/auth/me/model-usage` 应该返回 AgentSkill 的实时真实余额

文档 `docs/desktop-integration-guide.zh.md` 第 7.3 节明确写着：

> **服务端会反向同步上游**：每次调此接口，服务端会先去 AgentSkill 拉最新用量再返回，所以响应是**实时数据**（会有约 200ms 额外延迟）。

但目前 `quotaUsd` 似乎没有真正从 AgentSkill 同步，而是用了数据库里的固定值。

### 期望行为

**方案 A（推荐）：从 AgentSkill 实时查询余额**

`/auth/me/model-usage` 接口在返回前，应该用用户的 SK 去查询 AgentSkill 的实时余额（包括充值总额、赠送额度、已用金额），然后返回：
- `quotaUsd`：AgentSkill 真实的总额（含充值+赠送）
- `usedUsd`：AgentSkill 真实的已用
- `balanceUsd`：AgentSkill 真实的余额（= 总额 - 已用）

这样无论用户在 AgentSkill 充值、消费、获赠，Legis-Server 返回的余额都是准确的。

**方案 B：同步充值记录**

如果 AgentSkill 没有提供"用 SK 查余额"的 API，那 Legis-Server 需要通过其他方式（如 webhook、定时同步、或调用 AgentSkill 管理接口）获取用户的真实充值总额，更新 `quotaUsd`。

## AgentSkill 的接口情况

我们测试过，AgentSkill 只暴露了一个接口：
- `POST /v1/messages`（调模型，返回 token 用量）
- 用 SK 调 `/v1/usage`、`/api/balance`、`/v1/balance` 等路径都返回 404/HTML 错误页

**所以可能需要用 AgentSkill 的管理接口（非 SK 认证）来查真实余额**，类似当初 provision 时用的那套管理 API。

## 相关文件参考

- `docs/desktop-integration-guide.zh.md` — 桌面端集成文档（余额接口契约）
- `docs/AgentSkill-API-Doc.md` — AgentSkill 内部接口文档（可能有管理接口）
- `/auth/me/model-usage` 的实现代码 — 需要检查反向同步逻辑

## 验收标准

修复后，用测试账号 `2239553265@qq.com` 调 `/auth/me/model-usage`，`balanceUsd` 应该返回约 **$5.96**（而非现在的 $4.96），且用户在 AgentSkill 充值后，再次调用此接口余额会相应增加。
