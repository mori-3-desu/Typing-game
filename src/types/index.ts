export type SoundKey =
  | "type"
  | "miss"
  | "correct"
  | "gauge"
  | "combo"
  | "result"
  | "decision"
  | "cancel"
  | "start"
  | "finish"
  | "bs"
  | "diff"
  | "rankS"
  | "rankA"
  | "rankB"
  | "rankC"
  | "rankD";

// タイトルの画面状態
export type TitlePhase = "normal" | "input" | "confirm";

export type DifficultyLevel = "EASY" | "NORMAL" | "HARD";

export type DifficultyConfig = {
  bg: string; // 難易度ごとの画像パス
  time: number; // 制限時間
  chars: string; // "1 ~ 7 文字" など
  text: string; // 難易度毎の説明文
  bgm: string; // 曲
  color: string; // 難易度ごとのテーマカラー
};

// ---------------------------------------------------------
// 1. 純粋な「成績データ」だけの型を作る
// ---------------------------------------------------------
export type GameStats = {
  score: number;
  completedWords: number;
  correctCount: number;
  missCount: number;
  backspaceCount: number;
  maxCombo: number;
  currentSpeed: string | number;
  rank: string;
  missedWordsRecord: { word: string; misses: number }[];
  missedCharsRecord: { [key: string]: number };
  jpText: string;
  currentWordMiss: number;
};

// ---------------------------------------------------------
// 2. フックが受け取る「引数全体」の型
//    (ここに GameStats を 'currentStats' として含める)
// ---------------------------------------------------------
export type GameControlProps = {
  // ▼ 制御系 (State, Function)
  gameState: GameState;
  playPhase: PlayPhase;
  difficulty: DifficultyLevel;
  timeLeft: number;
  tick: (amount: number) => void;
  setGameState: (state: GameState) => void;
  processResult: (stats: GameResultStats) => void;

  // ▼ データ系 (さっき作った型をここで使う！)
  currentStats: GameStats;
};

export type UpdateHighscoreParams = {
  p_difficulty: DifficultyLevel; // "EASY" | "NORMAL" | "HARD" しか許さない！
  p_score: number;
  p_data: {
    name: string;
    correct: number;
    miss: number;
    backspace: number;
    combo: number;
    speed: number;
  };
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
};

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

// types.ts の末尾に追記

// ■ ゲーム全体の進行状態
export type GameState =
  | "loading"
  | "title"
  | "difficulty"
  | "playing"
  | "finishing"
  | "result"
  | "hiscore_review";

// ■ プレイ中のフェーズ
export type PlayPhase = "ready" | "go" | "game";

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

export type TimePopup = {
  id: number;
  text: string;
  isLarge: boolean;
};

export type PerfectPopup = { id: number };

export type WordDataMap = Record<string, { jp: string; roma: string }[]>;
