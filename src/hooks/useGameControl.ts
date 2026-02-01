import { useState, useEffect } from "react";
import { stopBGM, playSE } from "../utils/audio";
import { calculateFinalStats } from "../utils/gameUtils";
import { UI_TIMINGS } from "../utils/setting";
import { 
  type GameState, 
  type PlayPhase, 
  type GameResultStats, 
  type DifficultyLevel 
} from "../types";

// フックが受け取る引数の型定義
type GameControlProps = {
  gameState: GameState;
  playPhase: PlayPhase;
  difficulty: DifficultyLevel;
  timeLeft: number;
  tick: (amount: number) => void;
  setGameState: (state: GameState) => void;
  processResult: (stats: GameResultStats) => void;
  
  // ゲームの統計データ (calculateFinalStats用)
  score: number;
  completedWords: number;
  correctCount: number;
  missCount: number;
  backspaceCount: number;
  maxCombo: number;
  currentSpeed: string | number;
  rank: string;
  missedWordsRecord: any[];
  missedCharsRecord: any;
  jpText: string;
  currentWordMiss: number; // ref.current の値を渡す
};

const {
  TIMER_DECREMENT,
  TIMER_COUNT_DOWN,
  FINISH_ANIMATION,
  WHITE_FADE_OUT,
  GO_TO_RESULT
} = UI_TIMINGS.GAME;

export const useGameControl = (props: GameControlProps) => {
  const {
    gameState, playPhase, timeLeft, tick, setGameState, processResult,
    score, completedWords, correctCount, missCount, backspaceCount,
    maxCombo, currentSpeed, rank, missedWordsRecord, missedCharsRecord,
    jpText, currentWordMiss
  } = props;

  const [lastGameStats, setLastGameStats] = useState<GameResultStats | null>(null);
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
        score,
        completedWords,
        correctCount,
        missCount,
        backspaceCount,
        maxCombo,
        currentSpeed: Number(currentSpeed),
        rank,
        missedWordsRecord,
        missedCharsRecord,
        jpText,
        currentWordMiss,
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
    timeLeft, gameState, playPhase, 
    score, correctCount, missCount, backspaceCount, maxCombo, 
    currentSpeed, rank, missedWordsRecord, missedCharsRecord, 
    jpText, completedWords, currentWordMiss,
    processResult, setGameState
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