export type DifficultyLevel = "EASY" | "NORMAL" | "HARD";

type DifficultyConfig = {
  bg: string; // 難易度ごとの画像パス
  time: number;
  chars: string; // "1 ~ 7 文字" など
  text: string; // 難易度毎の説明文
  bgm: string;
  color: string; // 難易度ごとのテーマカラー
};

// 難易度ごとの設定データ
export const DIFFICULTY_SETTINGS: Record<DifficultyLevel, DifficultyConfig> = {
  EASY: {
    bg: "/images/sea.png",
    time: 100,
    chars: "1 ~ 7 文字",
    text: "初心者の方におすすめ。朝の爽やかな海でいざ練習！",
    bgm: "/bgm/Secret-Adventure.mp3",
    color: "#3ecfcf", // 水色系
  },
  NORMAL: {
    bg: "/images/sunset.png",
    time: 120,
    chars: "2 ~ 12文字",
    text: "標準的な難易度。美しい夕焼けの海と共にタイピング！",
    bgm: "/bgm/アトリエと電脳世界_2.mp3",
    color: "#90ff64", // 緑系
  },
  HARD: {
    bg: "/images/star.png",
    time: 150,
    chars: "2 ~ 長文多め",
    text: "上級者向け。満天の星空の海の下、限界に挑戦！",
    bgm: "/bgm/Stardust.mp3",
    color: "#ffff00", // 黄色系
  },
} as const;

// 連打メーターの設定値
export const GAUGE_CONFIG = {
  INITIAL_MAX: 150, // 連打メーター初期値
  INCREMENT: 50, // ゲージMAXした際の連打メーター上昇値
  CEILING: 300, // 連打メーター上限値
  RECOVER_SEC: 10, // 連打メーターMAX時のタイムボーナス上昇値
  GAIN: 1, // 正解で増える量
  PENALTY: 20, // ミスで減る量
};

// スコア計算の設定値
export const SCORE_CONFIG = {
  BASE_POINT: 100, // 正解キーの基本点
  MISS_PENALTY: 300, // ミス時の減点ポイント
  BACKSPACE_PENALTY: 1000, // バックスペース時の減点ポイント
  PERFECT_BONUS_CHAR_REN: 500, // 文字数×この値＝PERFECTボーナス
} as const;

// ランク基準
export const RANK_THRESHOLDS = {
  // ミスなく継続すれば比較的簡単に到達するのでランク追加したりで調整予定
  EASY: { S: 500000, A: 250000, B: 125000, C: 50000 },
  NORMAL: { S: 900000, A: 500000, B: 300000, C: 150000 },
  HARD: { S: 1300000, A: 800000, B: 500000, C: 250000 },
} as const;

// コンボに応じたクラス
export const COMBO_THRESHOLDS = {
  GOLD: 100,
  RAINBOW: 200,
} as const;

// コンボ数によるスコア倍率
export const SCORE_COMBO_MULTIPLIER = {
  // ここまで到達したらの閾値
  THRESHOLDS_LEVEL_1: 50,
  THRESHOLDS_LEVEL_2: 100,
  THRESHOLDS_LEVEL_3: 200,

  // コンボ倍率
  MULTIPLIER_BASE: 1,
  MULTIPLIER_MID: 2,
  MULTIPLIER_HIGH: 4,
  MULTIPLIER_MAX: 10,
} as const;

// コンボ継続タイムボーナス
export const COMBO_TIME_BONUS = {
  // 初期ボーナス値
  INIT_BONUS: 0,

  // ボーナスが発生する間隔
  INTERVAL_LEVEL_1: 20, // 20コンボごと
  INTERVAL_LEVEL_2: 25, // 25コンボごと
  INTERVAL_LEVEL_3: 30, // 30コンボごと

  // ここまで到達したらの閾値
  THRESHOLDS_LEVEL_1: 100, // 100コンボ
  THRESHOLDS_LEVEL_2: 200, // 200コンボ

  // タイムボーナス加算量
  BONUS_BASE: 1,
  BONUS_MID: 3,
  BONUS_MAX: 5,
};
