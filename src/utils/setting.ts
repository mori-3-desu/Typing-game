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
};

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
} as const; // as const をつけると誤って書き換えられなくなるので安全です

export const RANK_THRESHOLDS = {
  // ミスなく継続すれば比較的簡単に到達するのでランク追加したりで調整予定
  EASY: { S: 500000, A: 250000, B: 125000, C: 50000 },
  NORMAL: { S: 900000, A: 500000, B: 300000, C: 150000 },
  HARD: { S: 1300000, A: 800000, B: 500000, C: 250000 },
};
