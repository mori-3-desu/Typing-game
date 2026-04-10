import { useRef, useState } from "react";

import { DatabaseService } from "../services/database";
import { type DifficultyLevel, type RankingScore } from "../types";

type UseRankingProps = {
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
};

// abortに変更、バックエンドで受け取る形にしたので
// 無駄なリクエストを防ぐ。
export const useRanking = ({ difficulty, setDifficulty }: UseRankingProps) => {
  const [showRanking, setShowRanking] = useState(false);
  const [rankingData, setRankingData] = useState<RankingScore[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [isDevRankingMode, setIsDevRankingMode] = useState(false);
  const [rankingDataMode, setRankingDataMode] = useState<
    "global" | "dev" | null
  >(null);
  const abortRef = useRef<AbortController | null>(null);

  // 画面を共通リセットする
  const beginFetch = () => {
    setIsRankingLoading(true);
    setRankingDataMode(null);
    setRankingData([]);
  };

  const createSignal = () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  const fetchRanking = async (targetDiff?: DifficultyLevel) => {
    if (showRanking || isRankingLoading) return;

    const searchDiff = targetDiff ?? difficulty;
    if (targetDiff) setDifficulty(targetDiff);
    setShowRanking(true);
    setIsDevRankingMode(false);
    beginFetch();

    const signal = createSignal();

    try {
      const data = await DatabaseService.getRanking(searchDiff, signal);
      setRankingData(data);
      setRankingDataMode("global");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Ranking fetch error:", error);
    } finally {
      // 古い処理がstateを参照して更新させないようにする。
      if (!signal?.aborted) setIsRankingLoading(false);
    }
  };

  const handleShowDevScore = async () => {
    if (isDevRankingMode || isRankingLoading) return;

    beginFetch();
    const signal = createSignal();

    try {
      const data = await DatabaseService.getDevScore(difficulty, signal);
      setRankingData(data);
      setRankingDataMode("dev");
      setIsDevRankingMode(true);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("DevScore fetch error:", error);
    } finally {
      if (!signal?.aborted) setIsRankingLoading(false);
    }
  };

  const closeRanking = () => {
    abortRef.current?.abort();
    setShowRanking(false);
    setIsRankingLoading(false);
    setRankingDataMode(null);
    setRankingData([]);
  };

  return {
    showRanking,
    rankingData,
    rankingDataMode,
    isDevRankingMode,
    isRankingLoading,
    fetchRanking,
    handleShowDevScore,
    closeRanking,
  };
};
