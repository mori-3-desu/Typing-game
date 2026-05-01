import type { GameResultStats, GameState } from "../../../types";
import { LIMIT_DATA } from "../../../utils/constants";

type CalculateStatsParams = {
  score: number;
  completedWords: number;
  correctCount: number;
  missCount: number;
  backspaceCount: number;
  maxCombo: number;
  currentSpeed: number;
  rank: string;
  missedWordsRecord: { word: string; misses: number }[];
  missedCharsRecord: { [key: string]: number };
  jpText: string;
  currentWordMiss: number;
};

export const createGameStats = (
  overrides: Partial<GameResultStats> = {},
): GameResultStats => ({
  score: 0,
  words: 0,
  correct: 0,
  miss: 0,
  backspace: 0,
  combo: 0,
  speed: 0,
  rank: "-",
  weakWords: [],
  weakKeys: {},
  ...overrides, // ここで引数のデータを上書き結合
});

export const buildDisplayData = (
  gameState: GameState,
  reviewData: GameResultStats | null,
  lastGameStats: GameResultStats | null,
): GameResultStats => {
  if (gameState === "hiscore_review" && reviewData) return reviewData;

  if (gameState === "result" && lastGameStats) return lastGameStats;
  return createGameStats();
};

export const calculateFinalStats = (
  params: CalculateStatsParams,
): GameResultStats => {
  const {
    score,
    completedWords,
    correctCount,
    missCount,
    backspaceCount,
    maxCombo,
    currentSpeed,
    rank,
    missedWordsRecord,
    missedCharsRecord,
    jpText,
    currentWordMiss,
  } = params;

  // --- 1. 集計用Mapの作成 ---
  const weakWordMap = new Map<string, number>();

  // --- 2. 過去データの取り込み ---
  missedWordsRecord.forEach(({ word, misses }) => {
    weakWordMap.set(word, (weakWordMap.get(word) || 0) + misses);
  });

  // --- 3. 現在データの救出 (Refの値を使用) ---
  if (currentWordMiss > 0 && jpText) {
    weakWordMap.set(jpText, (weakWordMap.get(jpText) || 0) + currentWordMiss);
  }

  // --- 4. 配列化・ソート・フィルタリング ---
  const sortedWeakWordsRecord = Array.from(weakWordMap, ([word, misses]) => ({
    word,
    misses,
  }))
    .sort((a, b) => b.misses - a.misses)
    .slice(0, LIMIT_DATA.WEAK_DATA_LIMIT);

  // 結果データ作成
  return createGameStats({
    score,
    words: completedWords,

    correct: correctCount,
    miss: missCount,
    backspace: backspaceCount,
    combo: maxCombo,
    speed: currentSpeed,
    rank: rank,
    weakWords: sortedWeakWordsRecord,
    weakKeys: missedCharsRecord,
  });
};
