import type { ScorePopupType } from "../types";

type ComboClass = "is-rainbow" | "is-gold";

export const COMBO_THRESHOLDS = {
  GOLD: 100,
  RAINBOW: 200,
} as const;

export const SCORE_DIRECTION = {
  PENALTY: 0,
  GOLD: 1000,
  RAINBOW: 10000,
} as const;

const COMBO_CLASS = [
  { min: COMBO_THRESHOLDS.RAINBOW, class: "is-rainbow" },
  { min: COMBO_THRESHOLDS.GOLD, class: "is-gold" },
] as const;

const SCORE_POP_CLASS = [
  { min: SCORE_DIRECTION.RAINBOW, class: "popup-rainbow" },
  { min: SCORE_DIRECTION.GOLD, class: "popup-gold" },
  { min: 1, class: "popup-normal" },
] as const;

export const getComboClass = (combo: number): ComboClass | "" => {
  const config = COMBO_CLASS.find((item) => combo >= item.min);
  return config?.class ?? "";
};

export const decideScoreType = (amount: number): ScorePopupType => {
  if (amount <= 0) return "popup-miss";

  const config = SCORE_POP_CLASS.find((item) => amount >= item.min);
  return config?.class ?? "popup-normal";
};
