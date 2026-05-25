import { useCallback, useRef, useState } from "react";

import { importByCode } from "../../../services/migrationApi";
import { requireSession } from "../../../services/sessionHelpers";
import type { ImportState } from "../types";

export const useImportMigrationCode = () => {
  const [state, setState] = useState<ImportState>({ status: "idle" });
  const inFlightRef = useRef(false);

  const importCode = useCallback(async (code: string) => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setState({ status: "loading" });

    try {
      const session = await requireSession();
      const res = await importByCode(session.access_token, code);
      setState({ status: "success", name: res.name });
    } catch (e: unknown) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "コードの検証に失敗しました",
      });
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle" });
    inFlightRef.current = false;
  }, []);

  return {
    state,
    importCode,
    reset
  };
};
