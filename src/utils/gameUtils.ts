import { type GameResultStats } from "../types";
/**
 * デフォルト値を持った「空のスコアデータ」を作る関数
 * Partial<GameResultStats> を渡すことで、一部だけ上書きも可能
 */
export const createGameStats = (overrides: Partial<GameResultStats> = {}): GameResultStats => ({
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