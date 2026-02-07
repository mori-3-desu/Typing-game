import { useState, useEffect } from "react";
import { stopBGM, playSE } from "../utils/audio";
import { calculateFinalStats } from "../utils/gameUtils";
import { UI_TIMINGS } from "../utils/setting";
import {
  type GameResultStats,
  type GameControlProps,
} from "../types";

const {
  TIMER_DECREMENT,
  TIMER_COUNT_DOWN,
  FINISH_ANIMATION,
  WHITE_FADE_OUT,
  GO_TO_RESULT,
} = UI_TIMINGS.GAME;

export const useGameControl = (props: GameControlProps) => {
  const {
    gameState,
    playPhase,
    timeLeft,
    currentStats,
    tick,
    setGameState,
    processResult,
  } = props;

  const [lastGameStats, setLastGameStats] = useState<GameResultStats | null>(
    null,
  );
  const [isFinishExit, setIsFinishExit] = useState(false);
  const [isWhiteFade, setIsWhiteFade] = useState(false);

  // 1. タイマーのカウントダウン処理
  useEffect(() => {
    let interval: number;

    if (gameState === "playing" && playPhase === "game") {
      interval = window.setInterval(() => {
        tick(TIMER_DECREMENT);
      }, TIMER_COUNT_DOWN);
    }
    return () => clearInterval(interval);
  }, [gameState, playPhase, tick]);

  // 2. ゲーム終了判定と遷移処理
  useEffect(() => {
    if (gameState === "playing" && playPhase === "game" && timeLeft <= 0) {
      // --- ゲーム終了時の処理 ---
      stopBGM();
      playSE("finish");

      const finalStats = calculateFinalStats({
        ...currentStats,
        currentSpeed: Number(currentStats.currentSpeed),
      });

      setLastGameStats(finalStats);
      setGameState("finishing");
      setIsFinishExit(false);
      setIsWhiteFade(false);

      processResult(finalStats);

      // アニメーションシーケンス
      setTimeout(() => setIsFinishExit(true), FINISH_ANIMATION);
      setTimeout(() => setIsWhiteFade(true), WHITE_FADE_OUT);
      setTimeout(() => {
        setGameState("result");
        setIsWhiteFade(false);
        setIsFinishExit(false);
      }, GO_TO_RESULT);
    }
  }, [
    timeLeft,
    gameState,
    playPhase,
    currentStats,
    processResult,
    setGameState,
  ]);

  return {
    lastGameStats,
    setLastGameStats,
    isFinishExit,
    setIsFinishExit,
    isWhiteFade,
    setIsWhiteFade,
  };
};
