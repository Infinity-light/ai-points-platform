# Eval Report — Task #1 Sprint 1 Round 1

**Branch**: feature/task-table-openapi  
**Date**: 2026-04-02  
**Evaluator**: Evaluator Agent  
**Result**: FAIL (1 issue, minor)

---

## E1: 编译复核

| 检查 | 结果 |
|------|------|
| `pnpm --filter backend run build` | PASS — 零报错，零警告 |
| `pnpm --filter frontend run build` (vue-tsc + vite) | PASS — 零 TS 错误，构建产物正常 |

---

## E2: 后端接口代码审查

### T1 — Migration 020

文件：`backend/src/database/migrations/1700000000020-SimplifyVoteAndPoints.ts`

- up(): `UPDATE ... SET score=0 WHERE score IS NULL` → 正确，先填充再 ALTER
- `ALTER COLUMN score SET NOT NULL, SET DEFAULT 0, TYPE integer USING score::integer` → 正确
- down(): 回滚到 `decimal(6,2) NOT NULL DROP` → 正确
- **结论: PASS**

### T2 — ReviewVote entity

文件：`backend/src/meeting/entities/review-vote.entity.ts:37`

- `@Column({ type: 'integer', nullable: false, default: 0 })` — 符合规划要求
- `isApproval` 列保留（向后兼容）— 符合 PRD "不破坏性迁移" 约束
- **结论: PASS**

### T3 — MeetingService 投票逻辑

文件：`backend/src/meeting/meeting.service.ts`

- `CastVoteDto` 改为 `{ points: number }` — 正确（L22-24）
- `castVote()`: 校验 `dto.points >= 0 && Number.isInteger` — 正确（L98-100）
- upsert 逻辑：`existing.score = dto.points; existing.isApproval = false;` — 正确（L108-109）
- `confirmTask()`: 所有 votes 取 score，`calculateMedian(scores)` — 正确（L168-170），`finalScore = medianScore` — 正确（L170-171）
- `confirmTask()` 已去掉 `aiTotalScore` 参数 — 正确
- `getVoteStats()` 返回 `medianScore` — 正确
- `VoteStatsResult` 接口仍保留 `approvalCount / challengeCount`（legacy），在 `getVoteStats` 中置 0 — 可接受（向后兼容前端展示）
- **结论: PASS**

### T4 — MeetingGateway

文件：`backend/src/meeting/meeting.gateway.ts`

- `handleVote` data 类型 `{ meetingId, taskId, points }` — 正确（L118）
- 调用 `castVote({ points: data.points })` — 正确（L127）
- `handleConfirm` data 类型 `{ meetingId, taskId }` — 无 `aiTotalScore` — 正确（L169）
- **结论: PASS**

### T5 — SettlementService 结算公式

文件：`backend/src/settlement/settlement.service.ts`

- `settleFromMeeting()` L209: `finalPoints = Math.max(1, Math.round(taskResult.finalScore))` — 直接使用投票中位数，无 estimatedPoints 乘法 — 正确
- `settleProject()` L380: `finalPoints = Math.max(1, Math.round(finalScore))` — 同上 — 正确
- `triggerSettlement()` (旧投票路径) L86-89: 改为使用 AI 三维分之和（`research + planning + execution`）作为 finalPoints — 符合 PRD"仅用于无评审会议的 fallback" 语义，`estimatedPoints` 乘法已去除 — 正确
- **结论: PASS**

### T6 — CreateTaskDto / TaskService

文件：`backend/src/task/dto/create-task.dto.ts`, `backend/src/task/task.service.ts`

- `CreateTaskDto`: 只有 `title`, `description`, `metadata` — `estimatedPoints` 已移除 — 正确
- `UpdateTaskDto`: `PartialType(CreateTaskDto)` — 自动继承，无 `estimatedPoints` — 正确
- `TaskService.create()` L58: `estimatedPoints: null` — 硬编码 null（数据库列保留），新任务不接受预估工分输入 — 符合 PRD "历史数据保留，新任务 estimatedPoints 默认 null"
- `TaskService.update()` L82: 注释 "estimatedPoints no longer set from DTO"，DTO 中无该字段 — 正确
- **结论: PASS**

---

## E3: AI 接口

不涉及（Sprint 1 无新 AI 端点）。

---

## E4: Playwright E2E

不执行（Sprint 1 目标为后端/逻辑改造，不含新页面）。

---

## E5: 文档完整性

无文档变更要求，跳过。

---

## E6: 前端代码审查

### T7 — ProjectDetailPage.vue + services/task.ts

文件：`frontend/src/services/task.ts`

- `CreateTaskPayload`: 只有 `title`, `description`, `metadata` — `estimatedPoints` 已移除 — 正确（L27-31）
- `Task` 接口仍保留 `estimatedPoints: number | null` 字段（读取用，不是创建用）— 合理，向后兼容旧数据展示
- `ProjectDetailPage.vue` `createTask()` L128-133: 只传 `title`，无 `estimatedPoints` — 正确
- `grep estimatedPoints|newTaskPoints` 在 ProjectDetailPage.vue 中：**0 匹配** — 预估工分 UI 已完整移除 — 正确

### T8 — MeetingPage.vue + useMeeting.ts

文件：`frontend/src/pages/meeting/MeetingPage.vue`

- `votePoints` ref（L35）— 工分数输入，取代旧的 isApproval/score 双态 — 正确
- 投票 UI（L442-477）: 一个数字输入框 `type=number min=0` + "提交投票"按钮 — 符合 PRD
- AI 三维评分保留为只读参考卡片（L379-409）— 符合 PRD "仍作为参考信息展示"
- `castVote()` L162-165: `emitVote({ taskId, points: Math.round(votePoints.value) })` — 正确
- `confirmAndNext()` L177-178: `emitConfirm({ taskId })` — 无 `aiTotalScore` — 正确
- `getAiTotal()` / `getAiScoreLabel()` 仍存在（L240-250）— 用于只读展示，非计算用途 — 正确

文件：`frontend/src/composables/useMeeting.ts`

- `emitVote(opts: { taskId: string; points: number })` — 类型正确（L107）
- `emitConfirm(opts: { taskId: string })` — 无 `aiTotalScore` — 正确（L115）
- Socket emit `'vote'` 携带 `{ meetingId, taskId, points }` — 与 Gateway 匹配 — 正确

---

## E7: 代码质量审计

### 发现的问题

**[ISSUE-1] brain.service.ts 仍有 estimatedPoints 引用（未按规划清理）**

文件：`backend/src/brain/brain.service.ts`

- L78: `t.estimatedPoints ? \` ~${t.estimatedPoints}分\` : ''` — 系统 Prompt 中展示预估工分，对 AI 上下文无意义（新任务均为 null）
- L248/262/274/286: `suggestTasks()` 的返回类型、LLM Prompt、解析类型、`createTasksFromSuggestions()` 参数均含 `estimatedPoints`

**严重程度**: 次要（minor）。`brain.service.ts` 的改动在项目规划 Sprint 1 清单中被明确列为要求（"brain.service: 移除 estimatedPoints 引用"），但实际代码未执行此清理。

**影响**: 
- `suggestTasks()` 会让 LLM 返回带 `estimatedPoints` 字段的任务建议，但 `createTasksFromSuggestions()` L291-293 调用 `taskService.create()` 时未传该字段 — 运行时无功能性错误
- 代码与 PRD 语义不一致（"预估工分"概念已废弃，但智脑仍在向 LLM 请求该字段）

---

## E8: Lint/Build/逻辑验证

- 后端编译: PASS（NestJS nest build 无输出表示成功）
- 前端编译: PASS（vue-tsc 无 TS 错误，vite build 1925 模块正常）
- 结算逻辑: `finalPoints = Math.max(1, Math.round(median))` — 投票中位数直接作为工分，边界处理正确（最小 1 分）
- 投票校验: `dto.points < 0 || !Number.isInteger(dto.points)` — 正确拒绝负数和非整数；PRD 允许投 0 分（"投 0 分合法"），代码 `< 0` 而非 `<= 0`，0 分可以正常通过 — 正确

---

## E9: 评分

| 维度 | 分数 | 备注 |
|------|------|------|
| 编译 (E1) | 10/10 | 前后端均零报错 |
| 后端逻辑 (E2) | 10/10 | migration、entity、service、gateway 全部正确 |
| 前端改造 (E6) | 10/10 | MeetingPage、useMeeting、ProjectDetailPage 均符合规划 |
| 代码质量 (E7) | 7/10 | brain.service.ts 遗漏清理 |

**综合得分**: 37/40 (92.5%)

---

## 结论

**FAIL（需修复后重新 QA）**

Sprint 1 核心改造均已正确实现（migration、投票机制、结算公式、前端 UI），但存在一处遗漏：

**必须修复**:

`backend/src/brain/brain.service.ts` — 移除 `estimatedPoints` 引用：
1. L78: 去掉任务列表 Prompt 中的 `~${t.estimatedPoints}分` 展示
2. `suggestTasks()` 返回类型移除 `estimatedPoints`（L248, L274）
3. LLM Prompt 模板移除 `estimatedPoints:N` 字段（L262）
4. `createTasksFromSuggestions()` 参数类型移除 `estimatedPoints?`（L286）

修复后再次 `pnpm --filter backend run build` 通过即可通过 QA。
