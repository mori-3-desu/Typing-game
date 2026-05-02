import { useCallback, useEffect, useRef, useState } from "react";

import type { GameResultStats } from "../features/typing-game/types";
import { ScoreService } from "../services/scoreService";
import type { DifficultyLevel, SoundKey } from "../types";
import { playSE } from "../utils/audio";
import { UI_TIMINGS } from "../utils/constants";

const playRankSE = (rank: string) => {
  const rankMap: Record<string, string> = {
    S: "rankS",
    A: "rankA",
    B: "rankB",
    C: "rankC",
  };
  playSE((rankMap[rank] ?? "rankD") as SoundKey);
};

export const useGameResult = (difficulty: DifficultyLevel) => {
  const [highScore, setHighScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [scoreDiff, setScoreDiff] = useState(0);

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const hasSaved = useRef(false);

  const [resultAnimStep, setResultAnimStep] = useState(0);
  const resultTimersRef = useRef<number[]>([]);

  const saveScore = useCallback(
    async (stats: GameResultStats, playerName: string) => {
      // すでに保存済み、またはスコア0以下なら無視
      if (hasSaved.current || stats.score <= 0) {
        if (stats.score <= 0) setSaveStatus("success");
        return;
      }

      setSaveStatus("saving");

      // await中は非同期処理が走っている隙間がある。
      // その間に二回呼び出されてしまってもrefの同期的更新で防げる
      hasSaved.current = true;

      try {
        await ScoreService.saveRemote(difficulty, stats, playerName);
        setSaveStatus("success");
      } catch (error) {
        console.error("Score save failed:", error);
        setSaveStatus("error");
      }
    },
    [difficulty],
  );

  // ローカルストレージの計算処理
  const processResult = useCallback(
    (currentStats: GameResultStats) => {
      const result = ScoreService.processResult(difficulty, currentStats);
      setIsNewRecord(result.isNewRecord);
      setHighScore(result.highScore);
      setScoreDiff(result.diff);
    },
    [difficulty],
  );

  const clearTimers = () => {
    resultTimersRef.current.forEach(clearTimeout);
    resultTimersRef.current = [];
  };

  // アニメーション再生
  const playResultAnimation = useCallback((rank: string) => {
    setResultAnimStep(0);
    clearTimers();

    const schedule = [
      {
        delay: UI_TIMINGS.RESULT.STEP_1,
        sound: () => playSE("result"),
      },
      {
        delay: UI_TIMINGS.RESULT.STEP_2,
        sound: () => playSE("result"),
      },
      {
        delay: UI_TIMINGS.RESULT.STEP_3,
        sound: () => playSE("result"),
      },
      {
        delay: UI_TIMINGS.RESULT.STEP_4,
        sound: () => {
          playRankSE(rank);
        },
      },
      { delay: UI_TIMINGS.RESULT.STEP_5, sound: null },
    ];

    schedule.forEach(({ delay, sound }, i) => {
      const timer = window.setTimeout(() => {
        setResultAnimStep(i + 1);
        sound?.();
      }, delay);
      resultTimersRef.current.push(timer);
    });
  }, []);

  const resetResultState = useCallback(() => {
    setSaveStatus("idle");
    setIsNewRecord(false);
    hasSaved.current = false;
    setResultAnimStep(0);
    clearTimers();
  }, []);

  const skipAnimation = useCallback((rank: string, playSound = true) => {
    clearTimers();
    setResultAnimStep(5);
    if (playSound) {
      playRankSE(rank);
    }
  }, []);

  // アンマウント時のメモリリークを防ぎ、予期しない更新によるエラーを防ぐ
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  return {
    highScore,
    isNewRecord,
    scoreDiff,
    saveStatus,
    resultAnimStep,
    saveScore,
    processResult,
    playResultAnimation,
    skipAnimation,
    resetResultState,
  };
};
