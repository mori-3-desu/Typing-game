import { useCallback, useEffect, useRef, useState } from "react";

import { calculateFinalStats } from "../features/typing-game/utils/gameUtils";
import { type GameControlProps, type GameResultStats } from "../types";
import { playSE, stopBGM } from "../utils/audio";
import { UI_TIMINGS } from "../utils/constants";

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

  // -------------------------------------------------------
  // ■ State: 画面描画に必要なデータ
  // （これらが変わると画面が再描画される）
  // -------------------------------------------------------
  const [lastGameStats, setLastGameStats] = useState<GameResultStats | null>(
    null,
  );
  const [isFinishExit, setIsFinishExit] = useState(false);
  const [isWhiteFade, setIsWhiteFade] = useState(false);

  // Stateだと「値が変わる→再レンダリング→useEffect発火」の連鎖が起きるため、
  // 「値は最新にしたいが、それをトリガーに何かを動かしたくはない」データをRefに入れる。
  const latestStatsRef = useRef(currentStats);
  const latestProcessRef = useRef(processResult);

  // レンダリングのたびに、Refの中身を最新のpropsで上書きする
  // ※ここは「副作用(Effect)」の中でやるのが鉄則（後述の解説参照）
  useEffect(() => {
    latestStatsRef.current = currentStats;
    latestProcessRef.current = processResult;
  }, [currentStats, processResult]);

  const isProcessedRef = useRef(false);

  // 終了処理の関数化
  // この関数を下の useEffect から呼びたい。
  // そのまま書くと、レンダリングのたびに「新品の関数」として作り直されてしまい、
  // 依存配列に入れた useEffect が無駄に発火してしまう。
  // → useCallback で「関数を冷凍保存（メモ化）」する。
  const handleGameFinish = useCallback(() => {
    stopBGM();
    playSE("finish");

    // ここで props.currentStats を直接使うと、依存配列に currentStats を入れる必要が出る。
    // すると「データが変わるたびに関数が作り直し」になってしまう。
    // 代わりに「Ref（黒板）」を見に行くことで、
    // 「関数自体は作り直さずに、中身だけ最新データを使う」ことが可能になる。
    const stats = latestStatsRef.current;
    const proc = latestProcessRef.current;

    const finalStats = calculateFinalStats({
      ...stats,
      currentSpeed: stats.currentSpeed,
    });

    setLastGameStats(finalStats);
    proc(finalStats);
    setGameState("finishing");
  }, [setGameState, setLastGameStats]);

  // timeLeftを参照していたが、再実行するたびにintervalを作るためにintervalを消し続けるという無駄が発生していた
  // intervalの中身はtickを呼ぶだけ。tickがtimeLeftを管理してくれるため依存配列に不要。
  // ユーザーがそのタブを見ているかどうか判断する為にvisibilitychangeを使用。
  // 存在しないintervalを操作して挙動がおかしくなるのを防ぐために必ずクリーンアップを実施
  useEffect(() => {
    if (gameState !== "playing" || playPhase !== "game") return;
    let intervalId: number | null = null;

    const startTimer = () => {
      intervalId = window.setInterval(() => {
        tick(TIMER_DECREMENT);
      }, TIMER_COUNT_DOWN);
    };

    const stopTimer = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) stopTimer();
      else startTimer();
    };

    startTimer();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [gameState, playPhase, tick]);

  useEffect(() => {
    if (gameState !== "playing" || playPhase !== "game") return;

    // ゲーム開始時（残り時間がある時）は、ガードを解除して「待機状態」にする
    if (timeLeft > 0) isProcessedRef.current = false;

    // A. 終了条件チェック
    // ここで timeLeft を参照しているため、厳密には timeLeft が変わるたびに
    // この useEffect 自体は再実行（タイマーの再生成）されている。
    // しかし、handleGameFinish が「不変」であるため、ロジック自体は壊れない。
    if (timeLeft <= 0) {
      if (!isProcessedRef.current) {
        isProcessedRef.current = true;
        handleGameFinish();
      }
      return;
    }
  }, [gameState, playPhase, timeLeft, tick, handleGameFinish]);

  useEffect(() => {
    if (gameState !== "finishing") return;

    // ここは非同期（setTimeout）なので、state更新が連続してもバッチ処理されやすい
    const timer1 = setTimeout(() => setIsFinishExit(true), FINISH_ANIMATION);
    const timer2 = setTimeout(() => setIsWhiteFade(true), WHITE_FADE_OUT);
    const timer3 = setTimeout(() => {
      setGameState("result");
      setIsWhiteFade(false);
      setIsFinishExit(false);
    }, GO_TO_RESULT);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [gameState, setGameState]);

  return {
    lastGameStats,
    setLastGameStats,
    isFinishExit,
    setIsFinishExit,
    isWhiteFade,
    setIsWhiteFade,
  };
};
