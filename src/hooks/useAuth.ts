import { useEffect, useRef, useState } from "react";

import { ensureGuestSession } from "../services/ensureGuestSession";

type GuestSessionState = {
  error: Error | null;
};

/**
 * アプリ起動時にゲストセッション（HttpOnly Cookie）を確立する。
 * sliding 方式なので「訪問のたびに叩く＝バックエンドが発行 or 延長を reconcile」。
 * Cookie は HttpOnly で JS から読めないため、フロントは userId を持たず
 * 「確立できたか（isReady）」だけを判定材料にする。
 */
export const useAuth = (): GuestSessionState => {
  const [error, setError] = useState<Error | null>(null);

  // StrictMode の二重実行・再レンダーでの多重 POST を防ぐ
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const establish = async () => {
      try {
        await ensureGuestSession();
      } catch (e: unknown) {
        // 握りつぶさず error に載せ、呼び出し側で出し分ける（リモート保存を止める等）
        setError(
          e instanceof Error ? e : new Error("セッションの確立に失敗しました"),
        );
      }
    };

    establish();
  }, []);

  return { error };
};
