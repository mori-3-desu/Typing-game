import { useCallback, useEffect, useReducer, useRef } from "react";

import type { DifficultyLevel, WordDataMap } from "../../../types";
import { playSE } from "../../../utils/audio";
import {
  DIFFICULTY_SETTINGS,
  GAUGE_CONFIG,
  SCORE_CONFIG,
  UI_ANIMATION_CONFIG,
} from "../../../utils/constants";
import { calcComboTimeBonus } from "../logic/comboBonus";
import {
  buildRomaState,
  getCurrentTargetChar,
  isPerfectTyped,
} from "../logic/engineAdapter";
import { gameReducer, initialState } from "../logic/gameReducer";
import { COMBO_THRESHOLDS } from "../logic/popup";
import { getComboClass } from "../logic/popup";
import { calculateRank } from "../logic/rank";
import { calcHitScore, calculatePerfectBonus } from "../logic/scoreCalculation";
import {
  type InputResult,
  isCorrectStatus,
  isMissStatus,
} from "../logic/segment";
import { TypingEngine } from "../logic/typingEngine";
import { buildWordSetup } from "../logic/wordSetup";
import { usePopupManager } from "./usePopupManager";
import { useScoreAnimation } from "./useScoreAnimation";

type JudgeContext = {
  result: InputResult;
  targetChar: string | undefined;
};

export const useTypingGame = (
  difficulty: DifficultyLevel,
  wordData: WordDataMap | null,
) => {
  const [state, dispatch] = useReducer(gameReducer, {
    ...initialState,
    timeLeft: DIFFICULTY_SETTINGS[difficulty].time,
  });

  const engineRef = useRef<TypingEngine | null>(null);

  const {
    score,
    timeLeft,
    elapsedTime,
    combo,
    maxCombo,
    gaugeValue,
    gaugeMax,
    jpText,
    romaState,
    allSegments,
    correctCount,
    missCount,
    backspaceCount,
    completedWords,
    currentWordMiss,
    missedWordsRecord,
    missedCharsRecord,
    shakeStatus,
    scorePopups,
    timePopups,
    perfectPopups,
  } = state;

  const { displayScore, reset: resetDisplayScore } = useScoreAnimation(score);
  const {
    timeoutIdsRef,
    scheduleTrackedTimeout,
    addScorePopup,
    triggerPerfect,
    addTimePopUp,
  } = usePopupManager(dispatch);

  const rank = calculateRank(difficulty, score);
  const comboClass = getComboClass(combo);
  const isRainbowMode = combo >= COMBO_THRESHOLDS.RAINBOW;
  const currentSpeed = elapsedTime > 0.1 ? correctCount / elapsedTime : 0;

  const tick = useCallback((amount: number) => {
    dispatch({ type: "TICK", amount });
  }, []);

  // 役割: Class(TypingEngine)の内部状態を、React(View)用のデータに変換して渡す
  const syncEngineToReact = useCallback(() => {
    // エンジンが初期化されていない(null)時は何もしない
    // ※非同期読み込み中などに呼ばれてクラッシュするのを防ぐ
    if (!engineRef.current) return;
    dispatch({
      type: "UPDATE_DISPLAY",
      romaState: buildRomaState(engineRef.current),
      // engine.segments をそのまま渡すと「参照」が変わらないためReactが変更を無視する可能性がある。
      // スプレッド構文で新しい配列で渡すことで再レンダリングをトリガーさせる
      segments: [...engineRef.current.segments],
    });
  }, []);

  const loadRandomWord = useCallback(() => {
    // データ未ロード時の安全策
    if (!wordData) return;
    const { nextWord, engine, romaState } = buildWordSetup(
      wordData[difficulty],
      jpText,
      difficulty,
    );

    engineRef.current = engine;

    dispatch({
      type: "LOAD_WORD",
      jp: nextWord.jp,
      romaState,
      segments: [...engine.segments],
    });
  }, [difficulty, wordData, jpText]);

  const resetGame = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current.clear();

    dispatch({
      type: "RESET",
      initialTime: DIFFICULTY_SETTINGS[difficulty].time,
    });
    resetDisplayScore();
  }, [difficulty, timeoutIdsRef, resetDisplayScore]);

  const startGame = useCallback(() => {
    loadRandomWord();
  }, [loadRandomWord]);

  const handleBackspace = useCallback(() => {
    if (!engineRef.current) return;
    playSE("bs");
    engineRef.current.backspace();
    dispatch({ type: "BACKSPACE", penalty: SCORE_CONFIG.BACKSPACE_PENALTY });
    addScorePopup(-SCORE_CONFIG.BACKSPACE_PENALTY);
    syncEngineToReact();
  }, [syncEngineToReact, addScorePopup]);

  const processMiss = useCallback(
    (missType: "INPUT" | "COMPLETION", charStr?: string) => {
      playSE("miss");

      scheduleTrackedTimeout(
        () => {
          dispatch({ type: "SET_SHAKE", status: "none" });
        },
        missType === "INPUT"
          ? UI_ANIMATION_CONFIG.MISS_DURATION_MS
          : UI_ANIMATION_CONFIG.NO_ALLGREEN_DURATION_MS,
      );

      dispatch({
        type: "MISS",
        missType,
        charStr,
        penalty: SCORE_CONFIG.MISS_PENALTY,
        gaugePenalty: GAUGE_CONFIG.PENALTY,
      });
      addScorePopup(-SCORE_CONFIG.MISS_PENALTY);
    },
    [addScorePopup, scheduleTrackedTimeout],
  );

  const applyComboTimerPlus = useCallback(
    (combo: number) => {
      const bonus = calcComboTimeBonus(combo);
      if (!bonus) return;

      dispatch({ type: "ADD_TIME", sec: bonus.sec });
      addTimePopUp(bonus.sec, bonus.isLarge);
    },
    [addTimePopUp],
  );

  const processCorrectHit = useCallback(
    (currentCombo: number) => {
      playSE("type");
      const nextCombo = ++currentCombo;

      applyComboTimerPlus(nextCombo);
      const addScore = calcHitScore(nextCombo);

      dispatch({ type: "CORRECT_HIT", addScore, gaugeGain: GAUGE_CONFIG.GAIN });
      addScorePopup(addScore);
    },
    [applyComboTimerPlus, addScorePopup],
  );

  const handleImperfectClear = useCallback((): void => {
    dispatch({
      type: "RECORD_MISSED_WORD",
      word: jpText,
      misses: currentWordMiss,
    });
  }, [jpText, currentWordMiss]);

  const handlePerfectClear = useCallback(
    (engine: TypingEngine): void => {
      const bonus = calculatePerfectBonus(engine.displayLength);
      dispatch({ type: "PERFECT_BONUS", bonus });

      addScorePopup(bonus);
      triggerPerfect();
    },
    [addScorePopup, triggerPerfect],
  );

  const processWordCompletion = useCallback(() => {
    const engine = engineRef.current;

    if (!engine) return;
    if (!isPerfectTyped(engine)) return processMiss("COMPLETION");

    playSE("correct");

    if (currentWordMiss === 0) {
      handlePerfectClear(engine);
    } else {
      handleImperfectClear();
    }

    loadRandomWord();
  }, [
    currentWordMiss,
    loadRandomWord,
    processMiss,
    handlePerfectClear,
    handleImperfectClear,
  ]);

  const handlejudgeInput = useCallback(
    ({ result, targetChar }: JudgeContext): void => {
      if (isMissStatus(result.status)) {
        processMiss("INPUT", targetChar);
        return;
      }

      if (isCorrectStatus(result.status)) {
        processCorrectHit(combo);
      }
    },
    [combo, processCorrectHit, processMiss],
  );

  const handleKeyInput = useCallback(
    (key: string) => {
      const engine = engineRef.current;
      if (!engine) return;

      const targetChar = getCurrentTargetChar(engine);
      const result = engine.input(key);
      handlejudgeInput({ result, targetChar });

      syncEngineToReact();
      if (engine.segIndex >= engine.segments.length) {
        processWordCompletion();
      }
    },
    [handlejudgeInput, processWordCompletion, syncEngineToReact],
  );

  useEffect(() => {
    if (gaugeValue >= gaugeMax) {
      playSE("gauge");
      dispatch({ type: "ADD_TIME", sec: GAUGE_CONFIG.RECOVER_SEC });
      addTimePopUp(GAUGE_CONFIG.RECOVER_SEC, true);
      dispatch({ type: "GAUGE_MAX_REACHED" });
    }
  }, [gaugeValue, gaugeMax, addTimePopUp]);

  return {
    score,
    displayScore,
    combo,
    comboClass,
    maxCombo,
    timeLeft,
    gaugeValue,
    gaugeMax,
    rank,
    correctCount,
    missCount,
    completedWords,
    currentWordMiss,
    backspaceCount,
    jpText,
    romaState,
    allSegments,
    shakeStatus,
    missedWordsRecord,
    missedCharsRecord,
    isRainbowMode,
    perfectPopups,
    scorePopups,
    timePopups,
    handleKeyInput,
    handleBackspace,
    startGame,
    resetGame,
    tick,
    currentSpeed,
  };
};
