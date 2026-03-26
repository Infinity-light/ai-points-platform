export enum TaskStatus {
  OPEN = 'open',           // 待认领
  CLAIMED = 'claimed',     // 进行中
  SUBMITTED = 'submitted', // 已提交
  AI_REVIEWING = 'ai_reviewing', // AI审中
  PENDING_VOTE = 'pending_vote', // 待投票
  SETTLED = 'settled',     // 已固化
  CANCELLED = 'cancelled', // 已取消
}
