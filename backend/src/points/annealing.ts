export interface AnnealingInput {
  originalPoints: number;
  acquiredRound: number;
  currentRound: number;
  cyclesPerStep: number; // from project config, default 3
  maxSteps: number;      // from project config, default 9
}

export function calculateActivePoints(input: AnnealingInput): number {
  const { originalPoints, acquiredRound, currentRound, cyclesPerStep, maxSteps } = input;

  if (currentRound <= acquiredRound) {
    return originalPoints; // Not yet due for annealing
  }

  const roundDiff = currentRound - acquiredRound;
  const n = Math.floor(roundDiff / cyclesPerStep) + 1;

  if (n > maxSteps) {
    return 0; // Cleared
  }

  return Math.floor(originalPoints / n);
}

export function calculateNForRound(acquiredRound: number, currentRound: number, cyclesPerStep: number): number {
  if (currentRound <= acquiredRound) return 1;
  return Math.ceil((currentRound - acquiredRound) / cyclesPerStep) + 1;
}
