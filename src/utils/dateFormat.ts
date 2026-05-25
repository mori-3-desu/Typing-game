/**
 * ISO 文字列を日本時間の "2026/5/24 18:04" 形式に整形する。
 * バックエンドが返す `expires_at` / `created_at` 等の表示で使う。
 * ロケールに依存させず必ず `ja-JP` / `Asia/Tokyo` で揃える。
 */
export const formatJpDate = (isoString: string): string => {
  const d = new Date(isoString);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
