import { useState, useEffect, useCallback, useRef } from "react";
import { stopBGM, playSE } from "../utils/audio";
import { calculateFinalStats } from "../utils/gameUtils";
import { UI_TIMINGS } from "../utils/setting";
import { type GameResultStats, type GameControlProps } from "../types";

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

  // -------------------------------------------------------
  // ■ 1. 【データ避難所】 Refによる最新データの保持
  // -------------------------------------------------------
  // Stateだと「値が変わる→再レンダリング→useEffect発火」の連鎖が起きるため、
  // 「値は最新にしたいが、それをトリガーに何かを動かしたくはない」データをRefに入れる。
  // イメージ：こっそり裏で更新される「黒板」
  const latestStatsRef = useRef(currentStats);
  const latestProcessRef = useRef(processResult);

  // レンダリングのたびに、Refの中身を最新のpropsで上書きする
  // ※ここは「副作用(Effect)」の中でやるのが鉄則（後述の解説参照）
  useEffect(() => {
    latestStatsRef.current = currentStats;
    latestProcessRef.current = processResult;
  }, [currentStats, processResult]);

  // 「処理済みガード」：連打やReactのStrictモードによる2回実行を防ぐフラグ
  const isProcessedRef = useRef(false);

  // -------------------------------------------------------
  // ■ 2. 【アクション定義】 終了処理の関数化
  // -------------------------------------------------------
  // この関数を下の useEffect から呼びたい。
  // そのまま書くと、レンダリングのたびに「新品の関数」として作り直されてしまい、
  // 依存配列に入れた useEffect が無駄に発火してしまう。
  //
  // → useCallback で「関数を冷凍保存（メモ化）」する。
  const handleGameFinish = useCallback(() => {
    stopBGM();
    playSE("finish");

    // ★重要テクニック
    // ここで props.currentStats を直接使うと、依存配列に currentStats を入れる必要が出る。
    // すると「データが変わるたびに関数が作り直し」になってしまう。
    //
    // 代わりに「Ref（黒板）」を見に行くことで、
    // 「関数自体は作り直さずに、中身だけ最新データを使う」ことが可能になる。
    const stats = latestStatsRef.current;
    const proc = latestProcessRef.current;

    const finalStats = calculateFinalStats({
      ...stats,
      currentSpeed: Number(stats.currentSpeed),
    });

    setLastGameStats(finalStats);
    proc(finalStats);
    setGameState("finishing");

    // 依存配列には「めったに変わらない関数（setter）」だけ入れればOK。
    // これでこの関数は、コンポーネントの寿命が尽きるまで「不変」になる。
  }, [setGameState, setLastGameStats]);

  // -------------------------------------------------------
  // ■ 3. 【実行】 タイマー管理 & 終了監視
  // -------------------------------------------------------
  useEffect(() => {
    // ガード節：ゲーム中じゃなければ即終了
    if (gameState !== "playing" || playPhase !== "game") return;

    // ゲーム開始時（残り時間がある時）は、ガードを解除して「待機状態」にする
    if (timeLeft > 0) isProcessedRef.current = false;

    // A. 終了条件チェック
    // ここで timeLeft を参照しているため、厳密には timeLeft が変わるたびに
    // この useEffect 自体は再実行（タイマーの再生成）されている。
    // しかし、handleGameFinish が「不変」であるため、ロジック自体は壊れない。
    if (timeLeft <= 0) {
      // ガードチェック：既に処理済みなら何もしない
      if (!isProcessedRef.current) {
        isProcessedRef.current = true; // ロックをかける
        handleGameFinish(); // ★上で定義した「不変の関数」を実行！
      }
      return;
    }

    // 減らすことだけを考える
    const interval = window.setInterval(() => {
      tick(TIMER_DECREMENT);
    }, TIMER_COUNT_DOWN);

    // クリーンアップ：再レンダリングやアンマウント時に古いタイマーを消す
    return () => clearInterval(interval);
  }, [gameState, playPhase, timeLeft, tick, handleGameFinish]);
  // ↑ handleGameFinish は useCallback のおかげで変化しないので、
  //   実質 timeLeft の変化だけに反応して動く（今回はこれでOK）

  // -------------------------------------------------------
  // ■ 4. 【演出】 アニメーションシーケンス
  // -------------------------------------------------------
  // 「ロジック（計算）」と「ビュー（演出）」を分けたことで、コードがスッキリした
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
