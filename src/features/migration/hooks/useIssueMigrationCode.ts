import { useCallback, useRef, useState } from "react";

import { issueMigrationCode } from "../../../services/migrationApi";
import { requireSession } from "../../../services/sessionHelpers";
import type { CopyFeedback, IssueState } from "../types";

export const useIssueMigrationCode = () => {
  const [state, setState] = useState<IssueState>({ status: "idle" });
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const inFlightRef = useRef(false);

  const issue = useCallback(async () => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setState((prev) =>
      prev.status === "success" ? prev : { status: "loading" },
    );
    
    try {
      const session = await requireSession();
      const res = await issueMigrationCode(session.access_token);
      setState({
        status: "success",
        code: res.code,
        expires_at: res.expires_at,
      });
    } catch (e: unknown) {
      setState({
        status: "error",
        message:
          e instanceof Error ? e.message : "予期しないエラーが発生しました",
      });
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (state.status !== "success") return;

    if (!navigator.clipboard) {
      setCopyFeedback({
        kind: "error",
        message:
          "お使いのブラウザ、または接続環境（非HTTPS）ではコピー機能を利用できません。",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(state.code);
      setCopyFeedback({ kind: "success", message: "コピーに成功しました" });
    } catch {
      setCopyFeedback({ kind: "error", message: "コピーに失敗しました" });
    }
  }, [state]);

  const reset = useCallback(() => {
    setState({ status: "idle" });
    setCopyFeedback(null);
    inFlightRef.current = false;
  }, []);

  return {
    state,
    copyFeedback,
    issue,
    copyToClipboard,
    reset,
  };
};
