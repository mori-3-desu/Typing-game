import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export const useAuth = () => {
  // 変更点1: user_id -> userId, setUserid -> setUserId
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    // 認証状態の変更を監視するリスナーをセット
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // A. セッションがある (ログイン済み)
        if (session?.user) {
          setUserId(session.user.id);
        }
        // B. セッションがない (未ログイン、ログアウト) -> 匿名ログイン実行
        else {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error("Anonymous login failed:", error);
          } else if (data?.user) {
            setUserId(data.user.id);
          }
        }
      }
    );

    // クリーンアップ関数
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 変更点2: userId を返す (App.tsxと合わせるため)
  return { userId };
};