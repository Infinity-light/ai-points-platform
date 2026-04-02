// 队列名称常量，所有模块引用此文件，避免魔法字符串
export const QUEUE_NAMES = {
  AI_REVIEW: 'ai-review',
  NOTIFICATION: 'notification',
  SETTLEMENT: 'settlement',
  AUCTION_CLOSE: 'auction-close',
  FEISHU_SYNC: 'feishu-sync',
} as const;
