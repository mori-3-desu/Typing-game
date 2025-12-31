import { createClient } from '@supabase/supabase-js';

// .envファイルから環境変数を読み込む
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 環境変数がない場合のエラーチェック
if (!supabaseUrl || !supabaseKey) {
  throw new Error('SupabaseのURLまたはキーが設定されていません。.envを確認してください。');
}

// クライアントを作成してエクスポート
export const supabase = createClient(supabaseUrl, supabaseKey);