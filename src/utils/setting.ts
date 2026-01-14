export type DifficultyLevel = "EASY" | "NORMAL" | "HARD";

type DifficultyConfig = {
  bg:    string; // 難易度ごとの画像パス
  time:  number; // 制限時間
  chars: string; // "1 ~ 7 文字" など
  text:  string; // 難易度毎の説明文
  bgm:   string; // 曲
  color: string; // 難易度ごとのテーマカラー
};

// 難易度ごとの設定データ
export const DIFFICULTY_SETTINGS: Record<DifficultyLevel, DifficultyConfig> = {
  EASY: {
    bg:    "/images/sea.png",
    time:  100,
    chars: "1 ~ 7 文字",
    text:  "初心者の方におすすめ。朝の爽やかな海でいざ練習！",
    bgm:   "/bgm/Secret-Adventure.mp3",
    color: "#3ecfcf", // 水色系
  },
  NORMAL: {
    bg:    "/images/sunset.png",
    time:  120,
    chars: "2 ~ 12文字",
    text:  "標準的な難易度。美しい夕焼けの海と共にタイピング！",
    bgm:   "/bgm/アトリエと電脳世界_2.mp3",
    color: "#90ff64", // 緑系
  },
  HARD: {
    bg:    "/images/star.png",
    time:  150,
    chars: "2 ~ 長文多め",
    text:  "上級者向け。満天の星空の海の下、限界に挑戦！",
    bgm:   "/bgm/Stardust.mp3",
    color: "#ffff00", // 黄色系
  },
} as const;

// App.t
// プレイヤー名の最大文字数
export const PLAYER_NAME_CHARS = {
  MAX: 10
} as const;

// スケールサイズ
export const DISPLAY_SCALE = {
  WIDTH:  1200,
  HEIGHT:  780
}

// アニメーションや待機時間の定数管理
export const UI_TIMINGS = {
  // 共通・システム系
  MESSAGE_AUTO_CLOSE: 2000, // "名前を保存しました" 等の自動消去
  MIN_LOADING_TIME:   1000, // ロード画面を最低でも表示する時間

  // タイトル画面系
  TITLE: {
    BOUNCE_DELAY:      1200, // タイトルロゴが跳ね始めるまでの待機
    SHOW_DELAY:         500, // ロード完了後、タイトルを表示するまでの待機
    INPUT_LOCK:         500, // 入力ロック
    BUTTON_FADE_OUT:    700  // 入力フォームを開くときのアニメーション時間
  },

  // 難易度選択系
  DIFFICULTY: {
    SELECT_START: 600 // 難易度選択画面BGM開始
  },

  // ゲーム進行・リザルト系
  GAME: {
    READY_TO_GO:      1000, // Ready... から Go! になる間隔
    FINISH_ANIMATION: 1500, // "FINISH!" が出てからハケるまで
    WHITE_FADE_OUT:   2000, // ホワイトアウト開始
    GO_TO_RESULT:     2500, // リザルト画面へ完全に遷移する時間
  },
  
  // リザルト演出（スコアからランクまで遅らせて表示）
  RESULT: {
    STEP_1:  600, // スコア
    STEP_2: 1300, // 判定詳細
    STEP_3: 2000, // 苦手キー
    STEP_4: 3500, // ランク
    STEP_5: 4500, // ボタンとランキング、シェアアイコンを表示
  }
} as const;

// Ready?画面の座標管理、GOのスケール
export const READY_ANIMATION = {
  // Ready画面
  INIT: 800,
  DROP:  18,
}

// useTypingEngine
// 判定の色
export const JUDGE_COLOR = {
  CORRECT: "#4aff50", // 緑色
  MISS:    "#ff4444", // 赤色
} as const;

// useTypingGame
// UIの表示時間、アニメーション時間の設定
export const UI_ANIMATION_CONFIG = {
  POPUP_DURATION_MS:      1000, // 一秒でポップが消える(各種)
  TIME_DURATION_MS:        500, // 0.5秒でポップが消える(コンボのタイムボーナス)
  MISS_DURATION_MS:        200, // ミスタイプ時の揺らす演出
  NO_ALLGREEN_DURATION_MS: 400, // ミスが含まれている状態で最後まで入力された時の揺らす演出
  SCORE_FLUCTUATION_MS:     16, // スコア増減の演出(ダイヤル式、60FPS基準)
  SCORE_EASING:              5, // スコア増減の速さ(ダイヤルの速さ)
} as const;

// 連打メーターの設定値
export const GAUGE_CONFIG = {
  INITIAL_MAX: 150, // 連打メーター初期値
  GAIN:          1, // 正解で増える量
  PENALTY:      20, // ミスで減る量
  RECOVER_SEC:  10, // 連打メーターMAX時のタイムボーナス上昇値
  INCREMENT:    50, // ゲージMAXした際の連打メーター上昇値
  CEILING:     300, // 連打メーター上限値
};

// スコア計算の設定値
export const SCORE_CONFIG = {
  BASE_POINT:              100, // 正解キーの基本点
  PERFECT_BONUS_CHAR_REN:  500, // 文字数×この値＝PERFECTボーナス
  MISS_PENALTY:            300, // ミス時の減点ポイント
  BACKSPACE_PENALTY:      1000, // バックスペース時の減点ポイント
} as const;

// スコア増加量によって変わる演出
export const SCORE_DIRECTION = {
  PENALTY:     0, // 0点以下(useTypingGame.tsで条件をPENALTY > または < PENALTYと書く)
  GOLD:     1000,
  RAINBOW: 10000,
} as const;

// コンボに応じたクラス
export const COMBO_THRESHOLDS = {
  GOLD:    100,
  RAINBOW: 200,
} as const;

// コンボ数によるスコア倍率
export const SCORE_COMBO_MULTIPLIER = {
  // ここまで到達したらの閾値(コンボ)
  THRESHOLDS_LEVEL_1:  50,
  THRESHOLDS_LEVEL_2: 100,
  THRESHOLDS_LEVEL_3: 200,

  // コンボ倍率
  MULTIPLIER_BASE: 1,
  MULTIPLIER_MID:  2,
  MULTIPLIER_HIGH: 4,
  MULTIPLIER_MAX: 10,
} as const;

// コンボ継続タイムボーナス
export const COMBO_TIME_BONUS = {
  // 初期ボーナス値
  INIT_BONUS_SEC: 0,

  // ボーナスが発生する間隔
  INTERVAL_LEVEL_1: 20, // 20コンボごと
  INTERVAL_LEVEL_2: 25, // 25コンボごと
  INTERVAL_LEVEL_3: 30, // 30コンボごと

  // ここまで到達したらの閾値
  THRESHOLDS_LEVEL_1: 100, // 100コンボ
  THRESHOLDS_LEVEL_2: 200, // 200コンボ

  // タイムボーナス加算量
  BONUS_BASE_SEC: 1,
  BONUS_MID_SEC:  3,
  BONUS_MAX_SEC:  5,
};

// ランク基準
export const RANK_THRESHOLDS = {
  // ミスなく継続すれば比較的簡単に到達するのでランク追加したりで調整予定
  EASY:   { S:  500000, A: 250000, B: 125000, C:  50000 },
  NORMAL: { S:  900000, A: 500000, B: 300000, C: 150000 },
  HARD:   { S: 1300000, A: 800000, B: 500000, C: 250000 },
} as const;
