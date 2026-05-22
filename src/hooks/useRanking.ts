import { useRef, useState } from "react";

import { DatabaseService } from "../services/database";
import type { DifficultyLevel,RankingView,  } from "../types";

type UseRankingProps = {
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
};

type RankingMode = "global" | "dev";

// 全国ランキング(S3)開発者ランキング(API)の取得を束ねるオーケストレーター
// 取得結果は判別ユニオン RankingView に集約し、表示状態を一つの state で持つ。
export const useRanking = ({ difficulty, setDifficulty }: UseRankingProps) => {
  const [showRanking, setShowRanking] = useState(false);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [mode, setMode] = useState<RankingMode>("global");
  const [rankingView, setRankingView] = useState<RankingView | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const createSignal = () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  const fetchRanking = async (targetDiff?: DifficultyLevel) => {
    if (isRankingLoading) return;
    const searchDiff = targetDiff ?? difficulty;
    if (targetDiff) setDifficulty(targetDiff);

    setShowRanking(true);
    setMode("global");
    setRankingView(null);
    setIsRankingLoading(true);
    const signal = createSignal();

    try {
      const entries = await DatabaseService.getRanking(searchDiff, signal);
      setRankingView({mode: "global", entries});
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Ranking fetch error:", error);
    } finally {
      // 古い処理が後勝ちで state を参照して更新させないようにする。
      if (!signal?.aborted) setIsRankingLoading(false);
    }
  };

  const handleShowDevScore = async () => {
    if (isRankingLoading) return;

    setMode("dev");
    setRankingView(null);
    setIsRankingLoading(true);
    const signal = createSignal();

    try {
      const entries = await DatabaseService.getDevScore(difficulty, signal);
      setRankingView({mode: "dev", entries});
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("DevScore fetch error:", error);
    } finally {
      if (!signal.aborted) setIsRankingLoading(false);
    }
  };

  const closeRanking = () => {
    abortRef.current?.abort();
    setShowRanking(false);
    setIsRankingLoading(false);
    setMode("global");
    setRankingView(null);
  };

  return {
    showRanking,
    mode,
    rankingView,
    isRankingLoading,
    fetchRanking,
    handleShowDevScore,
    closeRanking,
  };
};
