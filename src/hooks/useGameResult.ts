import { useState, useCallback, useRef } from "react";
import { DatabaseService } from "../services/database";
import {
  type DifficultyLevel,
  type UpdateHighscoreParams,
  type GameResultStats,
} from "../types";
import { STORAGE_KEYS, UI_TIMINGS } from "../utils/setting";
import { playSE } from "../utils/audio";

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

  // ★修正点: 引数で stats と playerName を受け取るように変更
  const saveScore = useCallback(
    async (stats: GameResultStats, playerName: string) => {
      // すでに保存済み、またはスコア0以下なら無視
      if (hasSaved.current || stats.score <= 0) {
        if (stats.score <= 0) setSaveStatus("success");
        return;
      }

      setSaveStatus("saving");
      hasSaved.current = true; // 二重送信防止

      try {
        // 1. DBへの保存 (Supabase)
        const rpcParams: UpdateHighscoreParams = {
          p_difficulty: difficulty,
          p_score: stats.score,
          p_data: {
            name: playerName,
            correct: stats.correct,
            miss: stats.miss,
            backspace: stats.backspace,
            combo: stats.combo,
            speed: stats.speed,
          },
        };

        await DatabaseService.updateHighscore(rpcParams);
        setSaveStatus("success");
      } catch (error) {
        console.error("Score save failed:", error);
        setSaveStatus("error");
      }
    },
    [difficulty],
  ); // playerNameは引数なので依存配列にはいらない

  // ローカルストレージの計算処理（App.tsxにあった巨大なuseEffectの中身）
  const processResult = useCallback(
    (currentStats: GameResultStats) => {
      const storageKey = `${STORAGE_KEYS.HISCORE_REGISTER}${difficulty.toLowerCase()}`;
      const dataKey = `${STORAGE_KEYS.HISCORE_DATA_REGISTER}${difficulty.toLowerCase()}`;

      const savedScore = parseInt(localStorage.getItem(storageKey) || "0", 10);
      const diff = currentStats.score - savedScore;
      setScoreDiff(diff);

      if (currentStats.score > savedScore) {
        setIsNewRecord(true);
        setHighScore(currentStats.score);
        localStorage.setItem(storageKey, currentStats.score.toString());
        localStorage.setItem(dataKey, JSON.stringify(currentStats));
      } else {
        setIsNewRecord(false);
        setHighScore(savedScore);
      }
    },
    [difficulty],
  );

  // アニメーション再生（App.tsxから移植）
  const playResultAnimation = useCallback((rank: string) => {
    setResultAnimStep(0);
    resultTimersRef.current.forEach(clearTimeout);
    resultTimersRef.current = [];

    const schedule = [
      {
        step: 1,
        delay: UI_TIMINGS.RESULT.STEP_1,
        sound: () => playSE("result"),
      },
      {
        step: 2,
        delay: UI_TIMINGS.RESULT.STEP_2,
        sound: () => playSE("result"),
      },
      {
        step: 3,
        delay: UI_TIMINGS.RESULT.STEP_3,
        sound: () => playSE("result"),
      },
      {
        step: 4,
        delay: UI_TIMINGS.RESULT.STEP_4,
        sound: () => {
          if (rank === "S") playSE("rankS");
          else if (rank === "A") playSE("rankA");
          else if (rank === "B") playSE("rankB");
          else if (rank === "C") playSE("rankC");
          else playSE("rankD");
        },
      },
      { step: 5, delay: UI_TIMINGS.RESULT.STEP_5, sound: null },
    ];

    schedule.forEach(({ step, delay, sound }) => {
      const timer = window.setTimeout(() => {
        setResultAnimStep(step);
        if (sound) sound();
      }, delay);
      resultTimersRef.current.push(timer);
    });
  }, []);

  // リセット用
  const resetResultState = useCallback(() => {
    setSaveStatus("idle");
    setIsNewRecord(false);
    hasSaved.current = false;
    setResultAnimStep(0);
    resultTimersRef.current.forEach(clearTimeout);
    resultTimersRef.current = [];
  }, []);

  // 演出スキップ
  const skipAnimation = useCallback((rank: string, playSound = true) => {
    resultTimersRef.current.forEach(clearTimeout);
    resultTimersRef.current = [];
    setResultAnimStep(5);
    // ランク音だけ鳴らす
    if (playSound) {
      if (rank === "S") playSE("rankS");
      else if (rank === "A") playSE("rankA");
      else if (rank === "B") playSE("rankB");
      else if (rank === "C") playSE("rankC");
      else playSE("rankD");
    }
  }, []);

  // リザルト画面キー操作でも〇
  const handleResultKeyAction = (
    key: string,
    rank: string,
    onRetry: () => void,
    onBack: () => void,
  ) => {
    if (key === "Enter") {
      if (resultAnimStep < 5) skipAnimation(rank);
      else onRetry();
    } else if (key === "Escape") {
      if (resultAnimStep < 5) skipAnimation(rank);
      else onBack();
    }
  };

  return {
    highScore,
    isNewRecord,
    scoreDiff,
    saveStatus,
    resultAnimStep,
    saveScore, // 関数として外に出す
    processResult, // ローカル保存計算
    playResultAnimation,
    skipAnimation,
    resetResultState,
    handleResultKeyAction,
  };
};
