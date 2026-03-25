import { useRef,useState } from "react";

import { DatabaseService } from "../services/database";
import { type DifficultyLevel,type RankingScore } from "../types";

type UseRankingProps = {
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
};

export const useRanking = ({ difficulty, setDifficulty }: UseRankingProps) => {
  const [showRanking, setShowRanking] = useState(false);
  const [rankingData, setIsRankingData] = useState<RankingScore[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [isDevRankingMode, setIsDevRankingMode] = useState(false);
  const [rankingDataMode, setIsRankingDataMode] = useState<
    "global" | "dev" | null
  >(null);
  const rankingRequestIdRef = useRef(0);

  const fetchRanking = async (targetDiff?: DifficultyLevel) => {
    const requestId = ++rankingRequestIdRef.current;

    const searchDiff = targetDiff || difficulty;
    if (targetDiff) setDifficulty(targetDiff);

    // 2. 【超重要】通信を始める「前」に、画面の状態を強制リセット！
    // ここで一気に State を更新することで、React が「古いデータ」を描画する隙を与えない（チラツキ防止）
    setShowRanking(true);
    setIsRankingLoading(true);
    setIsDevRankingMode(false);
    setIsRankingDataMode(null);
    setIsRankingData([]);

    try {
      const data = await DatabaseService.getRanking(searchDiff);

      // 4. 通信が終わった時点で、自分が「最新の整理券」を持っているか確認
      // 違っていれば、それは「古いリクエスト」なので画面に反映せずに捨てる
      if (requestId !== rankingRequestIdRef.current) return;

      // 5. 最新のデータだけを安全にセット
      setIsRankingData(data);
      setIsRankingDataMode("global");
    } catch (error) {
      if (requestId !== rankingRequestIdRef.current) return;
      console.error("Ranking fetch error:", error);
    } finally {
      //  自分が最新のリクエストだった場合のみ、ローディング（スピナー）を終了する
      // （古いリクエストが after 処理で勝手にスピナーを消してしまうのを防ぐ）
      if (requestId === rankingRequestIdRef.current) {
        setIsRankingLoading(false);
      }
    }
  };

  const handleShowDevScore = async () => {
    if (isDevRankingMode || isRankingLoading) return;

    const requestId = ++rankingRequestIdRef.current;

    // 全国ランキングのデータを破棄して、画面を完全にリセット
    setIsRankingLoading(true);
    setIsRankingDataMode(null);
    setIsRankingData([]);

    try {
      const data = await DatabaseService.getDevScore(difficulty);

      if (requestId !== rankingRequestIdRef.current) return;

      // 5. 最新データのみセットし、モードを「開発者」に切り替える
      setIsRankingData(data);
      setIsRankingDataMode("dev");
      setIsDevRankingMode(true);
    } catch (error) {
      if (requestId !== rankingRequestIdRef.current) return;
      console.error("Ranking fetch error:", error);
    } finally {
      if (requestId === rankingRequestIdRef.current) {
        setIsRankingLoading(false);
      }
    }
  };

  const closeRanking = () => {
    rankingRequestIdRef.current += 1;
    setShowRanking(false);
    setIsRankingLoading(false);
    setIsRankingDataMode(null);
    setIsRankingData([]);
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
