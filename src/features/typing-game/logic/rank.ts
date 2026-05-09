import type { DifficultyLevel } from "../../../types";

const RANK_THRESHOLDS = {
  EASY: { S: 500000, A: 250000, B: 125000, C: 50000 },
  NORMAL: { S: 900000, A: 500000, B: 300000, C: 150000 },
  HARD: { S: 1300000, A: 800000, B: 500000, C: 250000 },
  EXTRA: { S: 1500000, A: 1000000, B: 750000, C: 400000},
} as const;

type Rank = "S" | "A" | "B" | "C" | "D";

export const calculateRank = (
  difficulty: DifficultyLevel,
  currentScore: number,
): Rank => {
  const th = RANK_THRESHOLDS[difficulty] || RANK_THRESHOLDS.NORMAL;
  if (currentScore >= th.S) return "S";
  if (currentScore >= th.A) return "A";
  if (currentScore >= th.B) return "B";
  if (currentScore >= th.C) return "C";
  return "D";
};
