---
name: PRD补齐实现验证 2026-03-29
description: AI工分制协作平台 PRD 缺口补齐（T01-T16）完整验证结果，包含一个 BLOCK 问题（公分表数据结构不匹配）
type: project
---

验证日期：2026-03-29
验证范围：T01-T16，对应分红记录、Skill注册、工分审批、公分表、智脑增强、前端页面

**Why:** PRD 补齐实现后需要独立 Evaluator 验证，确保没有遗漏或错误。

**How to apply:** 下次做类似验证时，优先检查前后端数据结构是否匹配（字段名、嵌套结构），这是最容易被忽视的集成点。

## 发现的问题

### BLOCK: 公分表 API 数据结构不匹配
- 后端 `getProjectPointsTable()` 返回 `{ members: ProjectPointsRow[] }`
- 前端 `points.ts` PointsTableSummary 接口定义为 `{ rows, totalActive, totalOriginal }`
- 前端消费代码：`res.data.rows` 和 `res.data.totalActive` 均为 undefined
- 文件: backend/src/points/points.service.ts line 240 vs frontend/src/services/points.ts line 11-15

### WARN: explore 提交不强制包含 Skill 信息
- 规划要求 explore 类型必须验证 skillName/skillDescription/skillContent
- 实现：`if (skillName !== undefined)` — 不传 skillName 则跳过验证和注册
- 文件: backend/src/submission/submission.service.ts line 52

## 通过项（20+）

所有后端测试 154/154 通过，TypeScript 编译无错误。
分红、Skill、工分审批的实体、服务、控制器均实现完整。
