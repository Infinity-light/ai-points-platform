---
name: 治理体系升级 M5 实时评审会议模块
description: T26-T35 实时评审会议模块完整实施记录，Socket.IO + 状态机更新 + 结算对接
type: project
---

## M5 模块已完成（T26-T35）

**Why:** 替换旧的投票流程，实现实时评审会议 + 多人贡献分配 + 中位数算法结算。

**How to apply:** 后续 T36+ 若需要扩展 meeting 功能，看这里的架构决策。

### 关键架构决策

1. **状态机变更**：AI_REVIEWING → PENDING_REVIEW（新主路径），PENDING_VOTE 保留向后兼容
2. **Socket.IO namespace**：`/meeting`，房间命名 `meeting:{uuid}`
3. **JWT 验证**：Gateway 在 `handleConnection` 中验证 `client.handshake.auth.token`
4. **结算桥接**：`settleFromMeeting` 把 `meetingId` 存入 `voteSessionId` 字段（都是 UUID）
5. **中位数算法**：认可票取 AI 总分参与，自定义票取其 score 值，偶数取两中间值平均四舍五入

### 新增文件

**后端：**
- `backend/src/meeting/entities/review-meeting.entity.ts`
- `backend/src/meeting/entities/review-vote.entity.ts`
- `backend/src/meeting/entities/task-contribution.entity.ts`
- `backend/src/meeting/meeting.service.ts`
- `backend/src/meeting/meeting.gateway.ts`
- `backend/src/meeting/meeting.controller.ts`
- `backend/src/meeting/meeting.module.ts`
- `backend/src/points/entities/points-snapshot.entity.ts`（新建实体）

**前端：**
- `frontend/src/services/meeting.ts`
- `frontend/src/composables/useMeeting.ts`
- `frontend/src/pages/meeting/MeetingPage.vue`（替换占位）

### 修改文件

- `task/enums/task-status.enum.ts`：新增 PENDING_REVIEW
- `task/task-state-machine.ts`：更新转换表
- `task/task.service.ts`：updateAiScores 改为 PENDING_REVIEW
- `task/entities/task.entity.ts`：新增 claimMode 字段
- `settlement/settlement.service.ts`：新增 settleFromMeeting
- `settlement/settlement.module.ts`：注册新实体
- `points/points.module.ts`：注册 PointsSnapshot
- `app.module.ts`：注册 MeetingModule
- `frontend/src/components/ui/StatusBadge.vue`：添加 pending_review 状态
- `frontend/src/services/task.ts`：TaskStatus 新增 pending_review
- `frontend/src/pages/project/ProjectDetailPage.vue`：添加"开启评审"按钮

### 测试结果

- 后端：175 tests passed
- 前后端 build 均通过（无 TS 错误）
