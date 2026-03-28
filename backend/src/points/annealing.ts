export interface AnnealingInput {
  originalPoints: number;
  acquiredRound: number;
  currentRound: number;
  cyclesPerStep: number; // from project config, default 3
  maxSteps: number;      // from project config, default 4 (clear when tier >= maxSteps)
}

/**
 * 计算工分的当前活跃值（考虑退火衰减）。
 *
 * 退火逻辑：每经历 cyclesPerStep 次结算，活跃工分衰减至 1/3。
 *   tier = floor((currentRound - acquiredRound) / cyclesPerStep)
 *   activePoints = floor(originalPoints / 3^tier)
 *
 * 示例（cyclesPerStep=3, maxSteps=4）：
 *   tier 0（roundDiff 0~2）: 100%
 *   tier 1（roundDiff 3~5）: 33.3%  → floor(originalPoints / 3)
 *   tier 2（roundDiff 6~8）: 11.1%  → floor(originalPoints / 9)
 *   tier 3（roundDiff 9~11）: 3.7%  → floor(originalPoints / 27)
 *   tier >= 4（roundDiff 12+）: 0   （清零）
 */
export function calculateActivePoints(input: AnnealingInput): number {
  const { originalPoints, acquiredRound, currentRound, cyclesPerStep, maxSteps } = input;

  if (currentRound <= acquiredRound) {
    return originalPoints;
  }

  const roundDiff = currentRound - acquiredRound;
  const tier = Math.floor(roundDiff / cyclesPerStep);

  if (tier >= maxSteps) {
    return 0;
  }

  return Math.floor(originalPoints / Math.pow(3, tier));
}

/**
 * 返回给定结算轮次下的退火除数 (3^tier)。
 * tier = floor((currentRound - acquiredRound) / cyclesPerStep)
 * divisor = 3^tier (与 calculateActivePoints 保持一致)
 */
export function calculateNForRound(
  acquiredRound: number,
  currentRound: number,
  cyclesPerStep: number,
): number {
  if (currentRound <= acquiredRound) return 1;
  const roundDiff = currentRound - acquiredRound;
  const tier = Math.floor(roundDiff / cyclesPerStep);
  return Math.pow(3, tier);
}
