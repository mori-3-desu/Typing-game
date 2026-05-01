export const getShareUrl = (score: number, rank: string): string => {
  const text = encodeURIComponent(
    `CRITICAL TYPINGでスコア:${score.toLocaleString()} ランク:${rank} を獲得しました！`,
  );
  const hashtags = encodeURIComponent("CRITICALTYPING,タイピング");
  const url = encodeURIComponent(window.location.origin);
  return `https://twitter.com/intent/tweet?text=${text}&hashtags=${hashtags}&url=${url}`;
};

