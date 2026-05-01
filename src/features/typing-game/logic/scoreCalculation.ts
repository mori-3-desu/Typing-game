import { SCORE_COMBO_MULTIPLIER, SCORE_CONFIG } from "../../../utils/constants";

const SCORE_BONUS = [
  {
    thresholds: SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_1,
    multiplier: SCORE_COMBO_MULTIPLIER.MULTIPLIER_BASE,
  },
  {
    thresholds: SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_2,
    multiplier: SCORE_COMBO_MULTIPLIER.MULTIPLIER_MID,
  },
  {
    thresholds: SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_3,
    multiplier: SCORE_COMBO_MULTIPLIER.MULTIPLIER_HIGH,
  },
] as const;

const getScoreMultiplier = (currentCombo: number) => {
  if (currentCombo < 0) return 0;

  const config = SCORE_BONUS.find((item) => currentCombo <= item.thresholds);
  return config?.multiplier ?? SCORE_COMBO_MULTIPLIER.MULTIPLIER_MAX;
};

export const calcHitScore = (combo: number): number => {
  const multiplier = getScoreMultiplier(combo);
  return SCORE_CONFIG.BASE_POINT * multiplier;
};

export const calculatePerfectBonus = (wordLength: number): number => {
  return wordLength * SCORE_CONFIG.PERFECT_BONUS_CHAR_REN;
};
