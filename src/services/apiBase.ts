/** 
 * API_BASE は Vite の環境変数経由でビルド時に注入される
 * 未設定のまま本番が動くと `fetch("undefined/api/...")` が 404 を返す形で
 * 静かに壊れる為、module load 時点で fail-fast する。
 */

const rawApiBase: string | undefined = import.meta.env.VITE_API_URL;

if (!rawApiBase) {
  throw new Error(
    "VITE_API_URL が設定されていません。.envを確認してください。"
  );
}

export const API_BASE: string = rawApiBase;