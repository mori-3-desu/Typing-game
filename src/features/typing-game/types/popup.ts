export type ScorePopupType =
  | "popup-normal"
  | "popup-gold"
  | "popup-rainbow"
  | "popup-miss";

export type ScorePopup = {
  id: number;
  text: string;
  type: ScorePopupType;
};

export type TimePopup = {
  id: number;
  text: string;
  isLarge: boolean;
};

export type PerfectPopup = { id: number };
