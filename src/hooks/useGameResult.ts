import { useCallback, useEffect, useRef, useState } from "react";
import { ScoreService } from "../services/scoreService";
import { type DifficultyLevel, type GameResultStats } from "../types";
import { playSE } from "../utils/audio";
import { UI_TIMINGS } from "../utils/constants";

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
  const handleResultKeyAction = useCallback(
    (key: string, rank: string, onRetry: () => void, onBack: () => void) => {
      if (resultAnimStep < 5) {
        if (key === "Enter" || key === "Escape") {
          skipAnimation(rank);
        }
        return;
      }

      if (key === "Enter") {
        onRetry();
      } else if (key === "Escape") {
        onBack();
      }
    },
    [resultAnimStep, skipAnimation],
  );

  useEffect(() => {
    // ★アンマウント時（クリーンアップ）
    return () => {
      // 全タイマーを爆破する
      resultTimersRef.current.forEach(clearTimeout);
      resultTimersRef.current = [];
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
    handleResultKeyAction,
  };
};
