import { useCallback, useState } from "react";

import { storage } from "../../../services/storage";
import { STORAGE_KEYS } from "../../../utils/constants";
import { buildHandoffCode } from "../logic/generateHandoffCode";

// 優先度は低いがメッセージがタイムアウトで消えるように設計する。
export const useHandoffCode = () => {
  const [code, setCode] = useState("");
  const [successCopied, setSuccessCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateCode = useCallback(() => {
    try {
      const source = {
        uuid: storage.getString(STORAGE_KEYS.USER_ID),
        refreshToken: storage.getString(STORAGE_KEYS.REFRESH_TOKEN),
        name: storage.getString(STORAGE_KEYS.PLAYER_NAME),
      };

      const generated = buildHandoffCode(source);
      setCode(generated);
      setError(null);
    } catch (e) {
      console.error("[generateCode]", e);
      setError("コードの生成に失敗しました。");
    }
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (!navigator.clipboard) {
      setError(
        "お使いのブラウザ、または接続環境（非HTTPS）ではコピー機能を利用できません。",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setSuccessCopied("コピーに成功しました");
      setError(null);
    } catch (e) {
      console.error("[Clipboard]", e);
      setError("コピーに失敗しました。");
    }
  }, [code]);

  const reset = useCallback(() => {
    setCode("");
    setError(null);
    setSuccessCopied(null);
  }, []);

  return { code, error, successCopied, generateCode, copyToClipboard, reset };
};
