import { calculateActivePoints, calculateNForRound } from './annealing';

describe('calculateActivePoints', () => {
  const base = {
    originalPoints: 100,
    acquiredRound: 1,
    cyclesPerStep: 3,
    maxSteps: 4,
  };

  // tier 0: roundDiff 0,1,2 → 100%
  it('同轮获得（roundDiff=0）— tier=0, 活跃=100', () => {
    expect(calculateActivePoints({ ...base, currentRound: 1 })).toBe(100);
  });
  it('roundDiff=2 — tier=0, 活跃=100', () => {
    expect(calculateActivePoints({ ...base, currentRound: 3 })).toBe(100);
  });

  // tier 1: roundDiff 3,4,5 → floor(100/3) = 33
  it('roundDiff=3 — tier=1, 活跃=33', () => {
    expect(calculateActivePoints({ ...base, currentRound: 4 })).toBe(33);
  });
  it('roundDiff=5 — tier=1, 活跃=33', () => {
    expect(calculateActivePoints({ ...base, currentRound: 6 })).toBe(33);
  });

  // tier 2: roundDiff 6,7,8 → floor(100/9) = 11
  it('roundDiff=6 — tier=2, 活跃=11', () => {
    expect(calculateActivePoints({ ...base, currentRound: 7 })).toBe(11);
  });
  it('roundDiff=8 — tier=2, 活跃=11', () => {
    expect(calculateActivePoints({ ...base, currentRound: 9 })).toBe(11);
  });

  // tier 3: roundDiff 9,10,11 → floor(100/27) = 3
  it('roundDiff=9 — tier=3, 活跃=3', () => {
    expect(calculateActivePoints({ ...base, currentRound: 10 })).toBe(3);
  });
  it('roundDiff=11 — tier=3, 活跃=3', () => {
    expect(calculateActivePoints({ ...base, currentRound: 12 })).toBe(3);
  });

  // tier >= maxSteps(4): 清零
  it('roundDiff=12 — tier=4 >= maxSteps=4, 活跃=0（清零）', () => {
    expect(calculateActivePoints({ ...base, currentRound: 13 })).toBe(0);
  });
  it('roundDiff 远超 maxSteps — 活跃=0', () => {
    expect(calculateActivePoints({ ...base, currentRound: 100 })).toBe(0);
  });

  // currentRound < acquiredRound (边界情况)
  it('当前轮次 < 获得轮次 — 返回原始工分', () => {
    expect(calculateActivePoints({ ...base, acquiredRound: 5, currentRound: 3 })).toBe(100);
  });

  // 自定义 cyclesPerStep
  it('cyclesPerStep=5, roundDiff=5 → tier=1, 活跃=floor(100/3)=33', () => {
    expect(calculateActivePoints({ ...base, cyclesPerStep: 5, currentRound: 6 })).toBe(33);
  });
  it('cyclesPerStep=5, roundDiff=4 → tier=0, 活跃=100', () => {
    expect(calculateActivePoints({ ...base, cyclesPerStep: 5, currentRound: 5 })).toBe(100);
  });

  // floor 取整
  it('floor 取整 — 原始10分, tier=1 → floor(10/3)=3', () => {
    expect(calculateActivePoints({ ...base, originalPoints: 10, currentRound: 4 })).toBe(3);
  });
  it('floor 取整 — 原始33分, tier=1 → floor(33/3)=11', () => {
    expect(calculateActivePoints({ ...base, originalPoints: 33, currentRound: 4 })).toBe(11);
  });

  // 0分特殊情况
  it('0原始工分 → 0活跃', () => {
    expect(calculateActivePoints({ ...base, originalPoints: 0, currentRound: 10 })).toBe(0);
  });
});

describe('calculateNForRound', () => {
  it('current <= acquired → divisor=1 (tier=0)', () => {
    expect(calculateNForRound(5, 5, 3)).toBe(1);
  });
  it('current < acquired → divisor=1', () => {
    expect(calculateNForRound(5, 3, 3)).toBe(1);
  });
  it('roundDiff=1, cyclesPerStep=3 → tier=0, divisor=1', () => {
    expect(calculateNForRound(1, 2, 3)).toBe(1);
  });
  it('roundDiff=2, cyclesPerStep=3 → tier=0, divisor=1', () => {
    expect(calculateNForRound(1, 3, 3)).toBe(1);
  });
  it('roundDiff=3, cyclesPerStep=3 → tier=1, divisor=3', () => {
    expect(calculateNForRound(1, 4, 3)).toBe(3);
  });
  it('roundDiff=6, cyclesPerStep=3 → tier=2, divisor=9', () => {
    expect(calculateNForRound(1, 7, 3)).toBe(9);
  });
  it('roundDiff=9, cyclesPerStep=3 → tier=3, divisor=27', () => {
    expect(calculateNForRound(1, 10, 3)).toBe(27);
  });
  it('roundDiff=12, cyclesPerStep=3 → tier=4, divisor=81', () => {
    expect(calculateNForRound(1, 13, 3)).toBe(81);
  });
});
