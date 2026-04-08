import type {
  DifficultyLevel,
  GameResultStats,
  ScoreRequestBody,
} from "../types";
import { STORAGE_KEYS } from "../utils/constants";
import { DatabaseService } from "./database";
import { parseNonNegativeInt,storage } from "./storage";

// ハイスコア取得と更新を切り分けて疎結合な構造に
// こちらではstorageで型チェックをしてもらいその結果で処理を分けている
const scoreKey = (level: DifficultyLevel) =>
  `${STORAGE_KEYS.HISCORE_REGISTER}${level.toLowerCase()}`;

const dataKey = (level: DifficultyLevel) =>
  `${STORAGE_KEYS.HISCORE_DATA_REGISTER}${level.toLowerCase()}`;

export const ScoreService = {
  getHighScore(level: DifficultyLevel): number {
    return storage.get(scoreKey(level), parseNonNegativeInt) ?? 0;
  },

  getHighScoreResult(level: DifficultyLevel): GameResultStats | null {
    return storage.get<GameResultStats>(dataKey(level), (raw) => {
      const data = JSON.parse(raw);
      if (typeof data?.score !== "number") throw new Error("invalid");
      return data as GameResultStats;
    });
  },

  // ローカル保存とリモート保存を切り分けている
  processResult(
    level: DifficultyLevel,
    current: GameResultStats,
  ): { isNewRecord: boolean; highScore: number; diff: number } {
    const saved = this.getHighScore(level);
    const diff = current.score - saved;

    if (current.score > saved) {
      storage.set(scoreKey(level), current.score.toString());
      storage.setJSON(dataKey(level), current);
      return { isNewRecord: true, highScore: current.score, diff };
    }

    return { isNewRecord: false, highScore: saved, diff };
  },

  async saveRemote(
    difficulty: DifficultyLevel,
    stats: GameResultStats,
    playerName: string,
  ): Promise<void> {
    const rpcParams: ScoreRequestBody = {
      difficulty: difficulty,
      score: stats.score,
      name: playerName,
      correct: stats.correct,
      miss: stats.miss,
      backspace: stats.backspace,
      combo: stats.combo,
      speed: stats.speed,
    };
    await DatabaseService.postScore(rpcParams);
  },
} as const;
