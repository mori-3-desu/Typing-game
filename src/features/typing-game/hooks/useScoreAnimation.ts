import { useCallback, useEffect, useRef, useState } from "react";
import { UI_ANIMATION_CONFIG } from "../../../utils/constants";

const easingScoreAnimation = (diff: number, deltaTime: number): number => {
  if (Math.abs(diff) <= 1) return diff;

  // 時間ベースのイージング（経過時間に応じて目標に近づく）
  // 100ms = 約63%目標へ、200ms = 約86%目標へ近づく、指数関数。
  const decayFactor = 1 - Math.exp(-deltaTime / UI_ANIMATION_CONFIG.SCORE_DECAY_MS)
  const step = diff * decayFactor;

  if (Math.abs(step) < 1) return diff > 0 ? 1 : -1;
  
  return step > 0 ? Math.ceil(step) : Math.floor(step);
};

// デルタタイム導入でモニターの差をなくす
export const useScoreAnimation = (targetScore: number) => {
  const [displayScore, setDisplayScore] = useState(0);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (displayScore === targetScore) {
      lastTimeRef.current = null;
      return;
    }

    const animate = (currentTime: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      const diff = targetScore - displayScore;
      const step = easingScoreAnimation(diff, deltaTime);
      setDisplayScore((prev) => prev + step);
    };

    const rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [targetScore, displayScore]);

  const reset = useCallback(() => {
    setDisplayScore(0);
    lastTimeRef.current = null;
  }, []);

  return { displayScore, reset };
};
