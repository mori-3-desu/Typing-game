 export type SoundKey =
  | "type" | "miss" | "correct" | "gauge" | "combo"
  | "result" | "decision" | "cancel" | "start" | "finish"
  | "bs" | "diff" | "rankS" | "rankA" | "rankB" | "rankC" | "rankD";

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

// 単語データ
export type MissedWord = { word: string; misses: number };

// ログ用
export type TypedLog = { char: string; color: string };

// ▼ ここが追加・修正された部分 ▼

// ローマ字入力の状態管理
export type RomaState = {
  typedLog: TypedLog[];
  current: string;
  remaining: string;
};

// 文字の分解セグメント（"ち" -> "ti" or "chi" の管理用）
export type Segment = {
  display: string;
  inputBuffer: string;
};

// ポップアップ系
export type BonusPopup = {
  id: number;
  text: string;
  type: "normal" | "large" | "miss";
};

export type Popup = BonusPopup;

export type ScorePopup = {
  id: number;
  text: string;
  type: "popup-normal" | "popup-gold" | "popup-rainbow" | "popup-miss";
};

export type PerfectPopup = { id: number };

export type WordDataMap = Record<string, { jp: string; roma: string }[]>;