import { calculateActivePoints, calculateNForRound } from './annealing';

describe('calculateActivePoints', () => {
  const base = {
    originalPoints: 100,
    acquiredRound: 1,
    cyclesPerStep: 3,
    maxSteps: 9,
  };

  // 轮次 1-3: n=1, 活跃 = 100
  it('轮次1 — n=1, 活跃工分=100', () => {
    expect(calculateActivePoints({ ...base, currentRound: 1 })).toBe(100);
  });
  it('轮次3 — n=1, 活跃工分=100', () => {
    expect(calculateActivePoints({ ...base, currentRound: 3 })).toBe(100);
  });

  // 轮次 4-6: n=2, 活跃 = 50
  it('轮次4 — n=2, 活跃工分=50', () => {
    expect(calculateActivePoints({ ...base, currentRound: 4 })).toBe(50);
  });
  it('轮次6 — n=2, 活跃工分=50', () => {
    expect(calculateActivePoints({ ...base, currentRound: 6 })).toBe(50);
  });

  // 轮次 7-9: n=3, 活跃 = 33
  it('轮次7 — n=3, 活跃工分=33', () => {
    expect(calculateActivePoints({ ...base, currentRound: 7 })).toBe(33);
  });
  it('轮次9 — n=3, 活跃工分=33', () => {
    expect(calculateActivePoints({ ...base, currentRound: 9 })).toBe(33);
  });

  // 轮次 10-12: n=4, 活跃 = 25
  it('轮次10 — n=4, 活跃工分=25', () => {
    expect(calculateActivePoints({ ...base, currentRound: 10 })).toBe(25);
  });

  // 当前轮次 = 获得轮次（同一轮）
  it('同一轮获得 — n=1, 活跃=原始', () => {
    expect(calculateActivePoints({ ...base, acquiredRound: 5, currentRound: 5 })).toBe(100);
  });

  // maxSteps 清零
  it('超过 maxSteps 清零', () => {
    // n = ceil((28-1)/3)+1 = ceil(9)+1 = 10 > maxSteps=9 → 0
    expect(calculateActivePoints({ ...base, currentRound: 28 })).toBe(0);
  });

  it('恰好 maxSteps 不清零', () => {
    // n = ceil((25-1)/3)+1 = ceil(8)+1 = 9 = maxSteps → floor(100/9) = 11
    expect(calculateActivePoints({ ...base, currentRound: 25 })).toBe(11);
  });

  // 自定义 cyclesPerStep
  it('cyclesPerStep=5, 轮次6 — n=2, 活跃=50', () => {
    expect(calculateActivePoints({ ...base, cyclesPerStep: 5, currentRound: 6 })).toBe(50);
  });

  // 小数点向下取整
  it('floor 取整 — 原始33分, n=2 → 16', () => {
    expect(calculateActivePoints({ ...base, originalPoints: 33, currentRound: 4 })).toBe(16);
  });

  // 0 分特殊情况
  it('0原始工分 → 0活跃', () => {
    expect(calculateActivePoints({ ...base, originalPoints: 0, currentRound: 1 })).toBe(0);
  });
});

describe('calculateNForRound', () => {
  it('current <= acquired → n=1', () => expect(calculateNForRound(5, 5, 3)).toBe(1));
  it('diff=1, cycles=3 → ceil(1/3)+1=2', () => expect(calculateNForRound(1, 2, 3)).toBe(2));
  it('diff=3, cycles=3 → ceil(1)+1=2', () => expect(calculateNForRound(1, 4, 3)).toBe(2));
  it('diff=4, cycles=3 → ceil(4/3)+1=3', () => expect(calculateNForRound(1, 5, 3)).toBe(3));
});
