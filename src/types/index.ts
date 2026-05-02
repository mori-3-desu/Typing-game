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

export type DifficultyLevel = "EASY" | "NORMAL" | "HARD" | "EXTRA";

export type DifficultyConfig = {
  bg: string; // 難易度ごとの画像パス
  time: number; // 制限時間
  chars: string; // "1 ~ 7 文字" など
  text: string; // 難易度毎の説明文
  bgm: string; // 曲
  color: string; // 難易度ごとのテーマカラー
  isEnglish?: boolean; // EXTRAのみ付与
};

// Spring Boot API の POST /api/scores が受け取る形式（ScoreRequest.java と対応）
export type ScoreRequestBody = {
  name: string;
  score: number;
  difficulty: DifficultyLevel;
  correct: number;
  miss: number;
  backspace: number;
  combo: number;
  speed: number;
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

// ■ ゲーム全体の進行状態
export type GameState =
  | "loading"
  | "title"
  | "difficulty"
  | "playing"
  | "finishing"
  | "result"
  | "hiscore_review";

// TODO: 未使用の可能性あり、削除前に要確認 (BonusPopup / Popup)
export type BonusPopup = {
  id: number;
  text: string;
  type: "normal" | "large" | "miss";
};

export type Popup = BonusPopup;

export type Word = { readonly jp: string; readonly roma: string }; // 基本の型
export type WordList = ReadonlyArray<Word>; // ArrayPrototypeしようするために分けてある
export type WordDataMap = Readonly<Record<DifficultyLevel, WordList>>; // 公開用、変更不可にする
export type MutableWordDataMap = Record<DifficultyLevel, Word[]>; // データ整形用

// typing-game feature 内で完結する型は features/typing-game/types/ に移動済み
// (PlayPhase, MissedWord, WeakWord, GameStats, GameResultStats, GameControlProps,
//  TypedLog, RomaState, ScorePopup/ScorePopupType, TimePopup, PerfectPopup)
// Segment は logic/segment.ts のクラスが本物。型重複を解消し削除。
