import { QUEUE_NAMES } from './queue.constants';

describe('QUEUE_NAMES', () => {
  it('should define all required queue names', () => {
    expect(QUEUE_NAMES.AI_REVIEW).toBe('ai-review');
    expect(QUEUE_NAMES.NOTIFICATION).toBe('notification');
    expect(QUEUE_NAMES.SETTLEMENT).toBe('settlement');
  });

  it('should have all queue names as string constants', () => {
    Object.values(QUEUE_NAMES).forEach((name) => {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });
});
