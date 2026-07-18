import type { DifficultyLevel } from "../../../types";

type Rank = "S" | "A" | "B" | "C" | "D";

type scoreRanks = { rank: Rank; score: number };

const RANK_THRESHOLDS = {
  EASY: [
    { rank: "S", score: 500000 },
    { rank: "A", score: 250000 },
    { rank: "B", score: 125000 },
    { rank: "C", score: 50000 },
  ],
  NORMAL: [
    { rank: "S", score: 900000 },
    { rank: "A", score: 500000 },
    { rank: "B", score: 300000 },
    { rank: "C", score: 150000 },
  ],
  HARD: [
    { rank: "S", score: 1300000 },
    { rank: "A", score: 800000 },
    { rank: "B", score: 500000 },
    { rank: "C", score: 250000 },
  ],
  EXTRA: [
    { rank: "S", score: 1500000 },
    { rank: "A", score: 1000000 },
    { rank: "B", score: 750000 },
    { rank: "C", score: 400000 },
  ],
} as const satisfies Record<DifficultyLevel, readonly scoreRanks[]>;

export const calculateRank = (
  difficulty: DifficultyLevel,
  currentScore: number,
): Rank => {
  const rankTable = RANK_THRESHOLDS[difficulty];
  return rankTable.find(({ score }) => currentScore >= score)?.rank ?? "D";
};
