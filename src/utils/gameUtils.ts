import { type DifficultyLevel, type GameResultStats } from "../types";
import {
  COMBO_THRESHOLDS,
  LIMIT_DATA,
  RANK_THRESHOLDS,
  SCORE_COMBO_MULTIPLIER,
} from "./constants";

export const calculateRank = (
  difficulty: DifficultyLevel,
  currentScore: number,
) => {
  const th = RANK_THRESHOLDS[difficulty] || RANK_THRESHOLDS.NORMAL;
  if (currentScore >= th.S) return "S";
  if (currentScore >= th.A) return "A";
  if (currentScore >= th.B) return "B";
  if (currentScore >= th.C) return "C";
  return "D";
};

export const getComboClass = (val: number) => {
  if (val >= COMBO_THRESHOLDS.RAINBOW) return "is-rainbow";
  if (val >= COMBO_THRESHOLDS.GOLD) return "is-gold";
  return "";
};

export const getScoreMultiplier = (currentCombo: number) => {
  if (currentCombo <= SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_1)
    return SCORE_COMBO_MULTIPLIER.MULTIPLIER_BASE;
  if (currentCombo <= SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_2)
    return SCORE_COMBO_MULTIPLIER.MULTIPLIER_MID;
  if (currentCombo <= SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_3)
    return SCORE_COMBO_MULTIPLIER.MULTIPLIER_HIGH;
  return SCORE_COMBO_MULTIPLIER.MULTIPLIER_MAX;
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
    weakWordMap.set(jpText, weakWordMap.get(jpText) || 0 + currentWordMiss);
  }

  // --- 4. 配列化・ソート・フィルタリング ---
  const sortedWeakWordsRecord = Array.from(weakWordMap, ([word, misses]) => ({
    word,
    misses,
  }))
    .sort((a, b) => b.misses - a.misses)
    .slice(0, LIMIT_DATA.WEAK_DATA_LIMIT);

  // 結果デ
  // 結果データ作成
  return createGameStats({
    score,
    // ★エラー2322の修正:
    // もし型定義が「完了した単語数(number)」を求めているなら .length をつける
    // もし型定義が「単語リスト(string[])」を求めているなら completedWords のままでOK
    // エラーが出ているということは、おそらく number が期待されています。
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
