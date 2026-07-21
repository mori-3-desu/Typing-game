type ComboTimeBonus = {
  threshold: number;
  interval: number;
  bonus: number;
  isLarge: boolean;
};

type TimePops = {
  sec: number;
  isLarge: boolean;
};

/**
 * calcComboTimeBonusのロジックではthresholdを降順で走査するため
 * thresholdは降順に並べる必要がある。
 */
const COMBO_LEVELS = [
  {
    threshold: 300,
    interval: 30,
    bonus: 5,
    isLarge: true,
  },
  {
    threshold: 200,
    interval: 25,
    bonus: 3,
    isLarge: false,
  },
  {
    threshold: 100,
    interval: 20,
    bonus: 1,
    isLarge: false,
  },
] as const satisfies ComboTimeBonus[];

/**
 * 現状は配列の数が3つなので可読性を意識した設計にしている
 * 
 * @param combo 現在のコンボ数
 * @returns タイムボーナスとアニメーションに必要な情報、ボーナス無しの場合はnull
 */
export const calcComboTimeBonus = (
  combo: number,
): TimePops | null => {
  const config = COMBO_LEVELS.find((c) => combo >= c.threshold);
  if (!config || combo % config.interval !== 0) return null;

  return { sec: config.bonus, isLarge: config.isLarge };
};
