export type DifficultyLevel = 'EASY' | 'NORMAL' | 'HARD';

export type DifficultyConfig = {
  bg: string;
  time: number;
  chars: string; // "1 ~ 7 文字" など
  text: string;
  bgm: string;
  color: string; // ★追加: 難易度ごとのテーマカラー
};

// 2. 難易度ごとの設定データ
// (画像パスは public フォルダ基準のパスに合わせています)
export const DIFFICULTY_SETTINGS: Record<DifficultyLevel, DifficultyConfig> = {
  EASY: { 
    bg: '/images/sea.png', 
    time: 100, 
    chars: "1 ~ 7 文字",
    text: '初心者の方におすすめ。朝の爽やかな海でいざ練習！',
    bgm: '/bgm/Secret-Adventure.mp3',
    color: "#3ecfcf" // ★追加: 水色系
  },
  NORMAL: { 
    bg: '/images/sunset.png', 
    time: 120, 
    chars: "2 ~ 12文字",
    text: '標準的な難易度。美しい夕焼けの海と共にタイピング！',
    bgm: '/bgm/アトリエと電脳世界_2.mp3',
    color: "#90ff64" // ★追加: 緑系
  },
  HARD: { 
    bg: '/images/star.png', 
    time: 150, 
    chars: "2 ~ 長文多め",
    text: '上級者向け。満天の星空の海の下、限界に挑戦！',
    bgm: '/bgm/Stardust.mp3',
    color: "#ffff00" // ★追加: 黄色系
  }
};

// 3. 連打メーターの設定値
export const GAUGE_CONFIG = {
  INITIAL_MAX: 150,
  INCREMENT: 50,
  CEILING: 300,
  RECOVER_SEC: 10,  // 変数名修正: RECONER -> RECOVER
  GAIN: 1,          // 正解で増える量
  PENALTY: 20       // ミスで減る量
};

// 4. 画像プリロード関数
export const preloadImages = () => {
  const imagesToLoad = ['/images/title.png'];

  // Object.valuesを使って設定から画像パスを取り出す
  Object.values(DIFFICULTY_SETTINGS).forEach((setting) => {
    imagesToLoad.push(setting.bg);
  });

  imagesToLoad.forEach((src) => {
    const img = new Image();
    img.src = src;
    // img.onload = () => console.log("Preloaded:", src); // 確認用
  });
};