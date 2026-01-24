import { type DifficultyLevel, type GameResultStats } from "../types";
import { STORAGE_KEYS } from "./setting";

// スコア数値のみ取得（後方互換）
export const getSavedHighScore = (level: DifficultyLevel): number => {
  const key = `${STORAGE_KEYS.HISCORE_REGISTER}${level.toLowerCase()}`;
  const saved = localStorage.getItem(key);
  return saved ? parseInt(saved, 10) : 0; // 10進数で保存
};

// 詳細データも取得
export const getSavedHighScoreResult = (level: DifficultyLevel) => {
  const key = `${STORAGE_KEYS.HISCORE_DATA_REGISTER}${level.toLowerCase()}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved) as GameResultStats; // 元のオブジェクトに変換
    } catch (e) {
      console.error("Save data parse error", e);
      return null;
    }
  }
  return null;
};