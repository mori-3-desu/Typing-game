import { useLayoutEffect, useRef } from "react";

import { DISPLAY_SCALE } from "../utils/constants";

// SSRではブラウザが存在しないからuseLayoutEffectが実行されないが
// 今回は同期的に値を更新したいだけなので
// 描画前に更新できるuseLayoutEffectで問題ない
export const useScaler = () => {
  const scalerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scaler = scalerRef.current;

    if (!scaler) return;

    // スケールの共通関数
    const applyScale = (width: number, height: number) => {
      const scale = Math.min(
        width / DISPLAY_SCALE.WIDTH,
        height / DISPLAY_SCALE.HEIGHT,
      );
      scaler.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };

    // ResizeObserverは対応していないブラウザもあるのでその場合はこちらを使う
    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => {
        applyScale(
          document.documentElement.clientWidth,
          document.documentElement.clientHeight,
        );
      };

      // 初回実行
      handleResize();
      window.addEventListener("resize", handleResize);

      // クリーンアップを実施
      return () => window.removeEventListener("resize", handleResize);
    }

    // 対応してる場合の処理、サイズが変わった時だけ実行
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        let width: number;
        let height: number;

        if (entry.contentBoxSize && entry.contentBoxSize.length > 0) {
          // contentBoxSize は配列で返ってくる（標準仕様）
          width = entry.contentBoxSize[0].inlineSize;
          height = entry.contentBoxSize[0].blockSize;
        } else {
          // 古いブラウザやポリフィル用のフォールバック
          width = entry.contentRect.width;
          height = entry.contentRect.height;
        }

        applyScale(width, height);
      }
    });

    observer.observe(document.documentElement);

    return () => {
      observer.disconnect();
    };
  }, []);
  return scalerRef;
};
