import { useRef, useState } from "react";

import { DatabaseService } from "../services/database";
import { type DifficultyLevel, type RankingScore } from "../types";

type UseRankingProps = {
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
};

export const useRanking = ({ difficulty, setDifficulty }: UseRankingProps) => {
  const [showRanking, setShowRanking] = useState(false);
  const [rankingData, setRankingData] = useState<RankingScore[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [isDevRankingMode, setIsDevRankingMode] = useState(false);
  const [rankingDataMode, setIsRankingDataMode] = useState<
    "global" | "dev" | null
  >(null);
  const rankingRequestIdRef = useRef(0);

  // 整理券を発行し、画面を共通リセットする
  const beginFetch = () => {
    rankingRequestIdRef.current += 1;
    setIsRankingLoading(true);
    setIsRankingDataMode(null);
    setRankingData([]);
    return rankingRequestIdRef.current;
  };

  // 自分が最新のリクエストかどうかを確認する
  const isLatest = (id: number) => id === rankingRequestIdRef.current;

  const fetchRanking = async (targetDiff?: DifficultyLevel) => {
    const requestId = beginFetch();
    const searchDiff = targetDiff || difficulty;
    if (targetDiff) setDifficulty(targetDiff);

    
    setShowRanking(true);
    setIsDevRankingMode(false);

    try {
      const data = await DatabaseService.getRanking(searchDiff);

      // 通信が終わった時点で、自分が「最新の整理券」を持っているか確認
      // 違っていれば、それは「古いリクエスト」なので画面に反映せずに捨てる
      if (!isLatest(requestId)) return;

      setRankingData(data);
      setIsRankingDataMode("global");
    } catch (error) {
      if (!isLatest(requestId)) return;
      console.error("Ranking fetch error:", error);
    } finally {
      if (isLatest(requestId)) setIsRankingLoading(false);
    }
  };

  const handleShowDevScore = async () => {
    if (isDevRankingMode || isRankingLoading) return;

    const requestId = beginFetch();

    try {
      const data = await DatabaseService.getDevScore(difficulty);

      if (!isLatest(requestId)) return;

      setRankingData(data);
      setIsRankingDataMode("dev");
      setIsDevRankingMode(true);
    } catch (error) {
      if (!isLatest(requestId)) return;
      console.error("DevScore fetch error:", error);
    } finally {
      if (isLatest(requestId)) setIsRankingLoading(false);
    }
  };

  const closeRanking = () => {
    rankingRequestIdRef.current += 1;
    setShowRanking(false);
    setIsRankingLoading(false);
    setIsRankingDataMode(null);
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
