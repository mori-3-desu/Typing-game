// タイトルの画面状態
export type TitlePhase = "normal" | "input" | "confirm";

export type DifficultyLevel = "EASY" | "NORMAL" | "HARD";

export type DifficultyConfig = {
  bg:    string; // 難易度ごとの画像パス
  time:  number; // 制限時間
  chars: string; // "1 ~ 7 文字" など
  text:  string; // 難易度毎の説明文
  bgm:   string; // 曲
  color: string; // 難易度ごとのテーマカラー
};

// ■ ランキングのデータ
export type RankingScore = {
  id: number;
  user_id: string;
  name: string;
  score: number;
  created_at: string;
  correct: number;
  miss: number;
  backspace: number;
  combo: number;
  speed: number;
  is_creator: boolean;
};

export type WordRow = {
  difficulty: string;
  jp: string;
  roma: string;
}

// ■ 苦手な単語（MissedWord と同じなのでこれを使います）
export type WeakWord = {
  word: string;
  misses: number;
};

export type WeakKey = {
  word: string;
  misses: number;
}

// ■ ゲーム結果・履歴データ
export type GameResultStats = {
  score: number;
  words: number;
  correct: number;
  miss: number;
  backspace: number;
  combo: number;
  speed: number;
  rank: string;
  weakWords: WeakWord[];
  weakKeys: { [key: string]: number };
};

export type MissedWord = { word: string; misses: number };
export type TypedLog = { char: string; color: string };
export type BonusPopup = {
  id: number;
  text: string;
  type: "normal" | "large" | "miss";
};
export type ScorePopup = {
  id: number;
  text: string;
  type: "popup-normal" | "popup-gold" | "popup-rainbow" | "popup-miss";
};
export type PerfectPopup = { id: number };
export type WordDataMap = Record<string, { jp: string; roma: string }[]>;