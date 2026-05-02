// エンジン内では「セグメントごと」にログを持っているが、
import { JUDGE_COLOR } from "../../../utils/constants";
import type { RomaState, TypedLog } from "../types";
import type { Segment } from "./segment";
import type { TypingEngine } from "./typingEngine";

// 画面表示用には「全履歴を一直線の配列」にしたいので、ここで結合する。
const buildTypedLog = (segments: Segment[]): TypedLog[] =>
  segments.flatMap((seg) => seg.typedLog);

export const buildRomaState = (engine: TypingEngine): RomaState => {
  // segIndexが配列の長さを超えてしまった場合のエラー防止。
  // Math.min を使うことで、必ず「最後のセグメント」で止まるようにする。
  const currentSegIndex = Math.min(engine.segIndex, engine.segments.length - 1);
  const currentSeg = engine.segments[currentSegIndex];

  // 実際に全文字打ち終わっているかどうかのフラグ
  const isFinished = engine.segIndex >= engine.segments.length;
  return {
    typedLog: buildTypedLog(engine.segments),
    current: !isFinished && currentSeg ? currentSeg.getCurrentChar() : "",
    remaining: !isFinished && currentSeg ? currentSeg.getRemaining() : "",
  };
};

// どうにかエンジンにUI責務を分離できないかを考える
export const isPerfectTyped = (engine: TypingEngine): boolean => {
  return engine.segments.every((s) =>
    s.typedLog.every((t) => t.color === JUDGE_COLOR.CORRECT),
  );
};

export const getCurrentTargetChar = (engine: TypingEngine): string | undefined => {
  return engine.segments[engine.segIndex]?.getCurrentChar();
};
