import { useEffect, useRef } from "react";
import { DISPLAY_SCALE, READY_GO_ANIMATION } from "../../utils/setting";
import { drawReadyAnimation, drawGoAnimation } from "../../utils/canvas";
import { type GameState, type PlayPhase } from "../../types";

type Props = {
  gameState: GameState;
  playPhase: PlayPhase;
};

export const GameCanvas = ({ gameState, playPhase }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const readyImageRef = useRef<HTMLImageElement | null>(null);

  // アニメーションの状態管理
  const animationState = useRef({
    readyY: -READY_GO_ANIMATION.INIT,
    isReadyAnimating: true,
    showEnterSpaceText: false,
    showGoText: false,
    goScale: READY_GO_ANIMATION.GO_INIT,
  });

  // 画像プリロード
  useEffect(() => {
    const img = new Image();
    img.src = "/images/Ready.jpg";
    img.onload = () => {
      readyImageRef.current = img;
    };
  }, []);

  // Canvasの初期設定（高解像度対応）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // ★ Retinaディスプレイ対応ロジック
      const dpr = window.devicePixelRatio || 1;
      
      // 内部解像度をDPI倍にする
      canvas.width = DISPLAY_SCALE.WIDTH * dpr;
      canvas.height = DISPLAY_SCALE.HEIGHT * dpr;

      // 表示サイズはCSS（style）で維持する
      canvas.style.width = `${DISPLAY_SCALE.WIDTH}px`;
      canvas.style.height = `${DISPLAY_SCALE.HEIGHT}px`;

      // コンテキストをスケーリングして、座標計算はそのままでOKにする
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    }
  }, []);

  // アニメーション状態のリセット
  useEffect(() => {
    if (gameState === "playing" && playPhase === "ready") {
      animationState.current = {
        readyY: -READY_GO_ANIMATION.INIT,
        isReadyAnimating: true,
        showEnterSpaceText: false,
        showGoText: false,
        goScale: READY_GO_ANIMATION.GO_INIT,
      };
    }
  }, [gameState, playPhase]);

  // アニメーションループ
  const animate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const state = animationState.current;

    // ゲーム中または終了演出中でなければループを止める
    if (gameState !== "playing" && gameState !== "finishing") return;

    if (canvas && ctx) {
      // 画面クリア（論理サイズで指定）
      ctx.clearRect(0, 0, DISPLAY_SCALE.WIDTH, DISPLAY_SCALE.HEIGHT);

      if (playPhase === "ready") {
        // 画像がロードされていない場合はスキップ（クラッシュ防止）
        if (readyImageRef.current) {
          if (state.isReadyAnimating) {
            state.readyY += READY_GO_ANIMATION.DROP;
            if (state.readyY >= 0) {
              state.readyY = 0;
              state.isReadyAnimating = false;
              state.showEnterSpaceText = true;
            }
          }
          drawReadyAnimation(
            ctx,
            DISPLAY_SCALE.WIDTH,
            DISPLAY_SCALE.HEIGHT,
            state.readyY,
            readyImageRef.current,
            state.showEnterSpaceText
          );
        }
      } else if (playPhase === "go") {
        if (state.goScale < READY_GO_ANIMATION.GO_MAX) {
          state.goScale += READY_GO_ANIMATION.GO_HIG;
        }
        drawGoAnimation(ctx, DISPLAY_SCALE.WIDTH, DISPLAY_SCALE.HEIGHT, state.goScale);
      } else if (playPhase === "game") {
        // ゲーム中はクリアするだけ
        ctx.clearRect(0, 0, DISPLAY_SCALE.WIDTH, DISPLAY_SCALE.HEIGHT);
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  // ループの開始・停止
  useEffect(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }

    if (gameState === "playing" || gameState === "finishing") {
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, playPhase]);

  return (
    <canvas
      ref={canvasRef}
      id="myCanvas"
      // finishing の時も隠さないようにする
      className={(gameState === "playing" || gameState === "finishing") ? "" : "hidden"}
      style={{ zIndex: 15, position: "relative", pointerEvents: "none" }}
    />
  );
};