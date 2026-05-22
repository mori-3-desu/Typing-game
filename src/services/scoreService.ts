import type { GameResultStats } from "../features/typing-game/types";
import type {
  DifficultyLevel,
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

// 全国ランキングで自分のエントリを特定するための created_at の保存キー。
const createdAtKey = (level: DifficultyLevel) =>
  `${STORAGE_KEYS.HISCORE_CREATED_AT}${level.toLowerCase()}`;

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

  // 全国ランキングで YOU を照合する為に実装
  // postScore のたびに保存される。未送信や localStorage をクリアした際は null となる
  getCreatedAt(level: DifficultyLevel): string | null {
    return storage.getString(createdAtKey(level));
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
    const result = await DatabaseService.postScore(rpcParams);

    // result.created_at は「DB の行を読み戻した現在値」。DB の created_at と
    // S3 ランキング JSON は updated=true のときだけ揃って変わるため、
    // 読み戻した値をそのまま毎回保存すれば常に S3 側と一致する。
    storage.set(createdAtKey(difficulty), result.created_at);
  },
} as const;
