// 規模が多くなったらファイル分けを検討
import { useEffect, useRef } from "react"; // useCallbackは削除
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
      const dpr = window.devicePixelRatio || 1;
      canvas.width = DISPLAY_SCALE.WIDTH * dpr;
      canvas.height = DISPLAY_SCALE.HEIGHT * dpr;
      canvas.style.width = `${DISPLAY_SCALE.WIDTH}px`;
      canvas.style.height = `${DISPLAY_SCALE.HEIGHT}px`;
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

  // ★ここを修正: アニメーションループをuseEffectに統合
  useEffect(() => {
    // ゲーム中または終了演出中でなければ、ループを開始しない（リターンする）
    if (gameState !== "playing" && gameState !== "finishing") return;

    // 前回のフレーム時間を記録
    let lastTime: number | null = null;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    // reqestAnimationFrameから現在の時間が返ってくる
    const render = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp; // 初回実行時の初期化

      // 1000で割ることでミリを秒にする。
      const deltaTime = (timestamp - lastTime) / 1000;

      lastTime = timestamp;

      // 次回のために今の時間を記録
      const state = animationState.current;

      if (canvas && ctx) {
        // 画面クリア
        ctx.clearRect(0, 0, DISPLAY_SCALE.WIDTH, DISPLAY_SCALE.HEIGHT);

        if (playPhase === "ready") {
          // Readyアニメーション
          if (readyImageRef.current) {
            if (state.isReadyAnimating) {
              state.readyY += READY_GO_ANIMATION.DROP * 60 * deltaTime;
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
              state.showEnterSpaceText,
            );
          }
        } else if (playPhase === "go") {
          // Goアニメーション
          if (state.goScale < READY_GO_ANIMATION.GO_MAX) {
            state.goScale += READY_GO_ANIMATION.GO_HIG;
          }
          drawGoAnimation(
            ctx,
            DISPLAY_SCALE.WIDTH,
            DISPLAY_SCALE.HEIGHT,
            state.goScale,
          );
        } else if (playPhase === "game") {
          // ゲーム中は描画するものがないので抜ける
          return;
        }
      }

      // 次のフレームを予約
      requestRef.current = requestAnimationFrame(render);
    };

    // ループ開始
    requestRef.current = requestAnimationFrame(render);
    // クリーンアップ関数: コンポーネントのアンマウント時や依存配列が変わった時に止める
    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, playPhase]); // 依存配列が変わると、一度ループが止まって新しい条件で再開される

  return (
    <canvas
      ref={canvasRef}
      id="myCanvas"
      className={
        gameState === "playing" || gameState === "finishing" ? "" : "hidden"
      }
      style={{ zIndex: 15, position: "relative", pointerEvents: "none" }}
    />
  );
};
