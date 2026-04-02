import { useEffect, useRef,useState } from "react";

import { supabase } from "../supabase";

export const useAuth = () => {
  const [userId, setUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // 処理重複防止のガード
  const initializedRef = useRef(false);

  useEffect(() => {
    // 監視役: 状態の反映のみ（ログイン実行は絶対にしない）
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? "");

      // 登録直後に一度発火して状態を教えてくれるので
      // ここで isLoading を false にする
      setIsLoading(false);
    });

    const ensureAnonymousUser = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      try {
        const {
          data: { session },
          // ここで getSession を使う理由は「能動的に今の状態を確認したいから」
          // onAuthStateChangeの初回発火を待つより、ここで明示的にチェックする方が
          // ロジックの実行順序として確実
        } = await supabase.auth.getSession();
        if (!session) {
          const { error: signInError } =
            await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;
        }
      } catch (e) {
        setError(e as Error);
      } finally {
        setIsLoading(false);
      }
    };

    ensureAnonymousUser();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { userId, isLoading, error };
};
