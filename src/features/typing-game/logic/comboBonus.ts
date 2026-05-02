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
  BONUS_MID_SEC: 3,
  BONUS_MAX_SEC: 5,
} as const;

const COMBO_LEVELS = [
  {
    threshold: COMBO_TIME_BONUS.THRESHOLDS_LEVEL_1,
    interval: COMBO_TIME_BONUS.INTERVAL_LEVEL_1,
    bonus: COMBO_TIME_BONUS.BONUS_BASE_SEC,
    isLarge: false,
  },
  {
    threshold: COMBO_TIME_BONUS.THRESHOLDS_LEVEL_2,
    interval: COMBO_TIME_BONUS.INTERVAL_LEVEL_2,
    bonus: COMBO_TIME_BONUS.BONUS_MID_SEC,
    isLarge: false,
  },
  {
    threshold: Infinity,
    interval: COMBO_TIME_BONUS.INTERVAL_LEVEL_3,
    bonus: COMBO_TIME_BONUS.BONUS_MAX_SEC,
    isLarge: true,
  },
] as const;

export const calcComboTimeBonus = (
  combo: number,
): { sec: number; isLarge: boolean } | null => {
  if (combo === 0) return null;
  
  const config = COMBO_LEVELS.find((c) => combo <= c.threshold);
  if (!config || combo % config.interval !== 0) return null;

  return { sec: config.bonus, isLarge: config.isLarge };
};
