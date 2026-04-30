import { useCallback, useEffect, useReducer, useRef } from "react";

import type {
  DifficultyLevel,
  RomaState,
  TypedLog,
  WordDataMap,
} from "../../../types";
import { playSE } from "../../../utils/audio";
import {
  COMBO_THRESHOLDS,
  COMBO_TIME_BONUS,
  DIFFICULTY_SETTINGS,
  GAUGE_CONFIG,
  JUDGE_COLOR,
  SCORE_CONFIG,
  UI_ANIMATION_CONFIG,
} from "../../../utils/constants";
import type { GameAction } from "../logic/gameReducer";
import { gameReducer, initialState } from "../logic/gameReducer";
import { calcHitScore, calculatePerfectBonus } from "../logic/scoreCalculation";
import {
  type InputResult,
  isCorrectStatus,
  isMissStatus,
  Segment,
} from "../logic/segment";
import { TypingEngine } from "../logic/typingEngine";
import { buildWordSetup } from "../logic/wordSetup";
import {
  calculateRank,
  decideScoreType,
  getComboClass,
} from "../utils/gameUtils";
import { useScoreAnimation } from "./useScoreAnimation";

type JudgeContext = {
  result: InputResult;
  targetChar: string | undefined;
};

// エンジン内では「セグメントごと」にログを持っているが、
// 画面表示用には「全履歴を一直線の配列」にしたいので、ここで結合する。
const buildTypedLog = (segments: Segment[]): TypedLog[] =>
  segments.flatMap((seg) => seg.typedLog);

const buildRomaState = (engine: TypingEngine): RomaState => {
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

const COMBO_LEVELS = [
  {
    threshold: COMBO_TIME_BONUS.THRESHOLDS_LEVEL_1,
    interval: COMBO_TIME_BONUS.INTERVAL_LEVEL_1,
    bonus: COMBO_TIME_BONUS.BONUS_BASE_SEC,
    isLarge: false,
  },
  {
    threshold: COMBO_TIME_BONUS.THRESHOLDS_LEVEL_2,
    interval: COMBO_TIME_BONUS.INTERVAL_LEVEL_2,
    bonus: COMBO_TIME_BONUS.BONUS_MID_SEC,
    isLarge: false,
  },
  {
    threshold: Infinity,
    interval: COMBO_TIME_BONUS.INTERVAL_LEVEL_3,
    bonus: COMBO_TIME_BONUS.BONUS_MAX_SEC,
    isLarge: true,
  },
];

// どうにかエンジンにUI責務を分離できないかを考える
const isPerfectTyped = (engine: TypingEngine): boolean => {
  return engine.segments.every((s) =>
    s.typedLog.every((t) => t.color === JUDGE_COLOR.CORRECT),
  );
};

const getCurrentTargetChar = (engine: TypingEngine): string | undefined => {
  return engine.segments[engine.segIndex]?.getCurrentChar();
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
  const popupIdRef = useRef(0);
  const timeoutIdsRef = useRef<Set<number>>(new Set());

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
  const rank = calculateRank(difficulty, score);
  const comboClass = getComboClass(combo);
  const isRainbowMode = combo >= COMBO_THRESHOLDS.RAINBOW;
  const currentSpeed = elapsedTime > 0.1 ? correctCount / elapsedTime : 0;

  // タイムアウトを安全にスケジュール・管理する共通関数
  const scheduleTrackedTimeout = useCallback(
    (callback: () => void, delayMs: number) => {
      const timeoutId = window.setTimeout(() => {
        callback();
        timeoutIdsRef.current.delete(timeoutId); // 実行完了したらリストから消す
      }, delayMs);
      timeoutIdsRef.current.add(timeoutId); // 実行前にリストへ登録
      return timeoutId;
    },
    [],
  );

  // ポップアップを被らせないようにrefで管理、共通化
  const showTrackedPopup = useCallback(
    (
      buildAddAction: (id: number) => GameAction,
      buildRemoveAction: (id: number) => GameAction,
      duration: number,
    ) => {
      popupIdRef.current += 1;
      const newId = popupIdRef.current;
      dispatch(buildAddAction(newId));
      
      scheduleTrackedTimeout(() => {
        dispatch(buildRemoveAction(newId));
      }, duration);
    },
    [scheduleTrackedTimeout],
  );

  const addScorePopup = useCallback(
    (amount: number) => {
      const type = decideScoreType(amount);
      const text = amount > 0 ? `+${amount}` : `${amount}`;
      showTrackedPopup(
        (id) => ({ type: "ADD_SCORE_POPUP", popup: { id, text, type } }),
        (id) => ({ type: "REMOVE_SCORE_POPUP", id }),
        UI_ANIMATION_CONFIG.POPUP_DURATION_MS,
      );
    },
    [showTrackedPopup],
  );

  const triggerPerfect = useCallback(() => {
    showTrackedPopup(
      (id) => ({ type: "ADD_PERFECT_POPUP", popup: { id } }),
      (id) => ({ type: "REMOVE_PERFECT_POPUP", id }),
      UI_ANIMATION_CONFIG.POPUP_DURATION_MS,
    );
  }, [showTrackedPopup]);

  const addTimePopUp = useCallback(
    (sec: number, isLarge: boolean = false) => {
      dispatch({ type: "ADD_TIME", sec });
      showTrackedPopup(
        (id) => ({
          type: "ADD_TIME_POPUP",
          popup: { id, text: `+${sec}秒`, isLarge },
        }),
        (id) => ({ type: "REMOVE_TIME_POPUP", id }),
        UI_ANIMATION_CONFIG.TIME_DURATION_MS,
      );
    },
    [showTrackedPopup],
  );

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

  // todo: startGame / resetGame はタイピング判定・スコア計算とは層が違うフロー制御
  // useGameFlow のような専用フックへの切り出しを検討したい
  const resetGame = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current.clear();

    dispatch({
      type: "RESET",
      initialTime: DIFFICULTY_SETTINGS[difficulty].time,
    });
    resetDisplayScore();
  }, [difficulty, resetDisplayScore]);

  // todo: loadRandomWord の薄いラッパーになっており役割が曖昧
  // ゲーム開始時固有の処理（SE・アニメーション等）が増えた場合に責務を整理したい
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
      if (combo === 0) return;

      const config = COMBO_LEVELS.find((num) => combo <= num.threshold);

      if (config && combo % config.interval === 0) {
        playSE("combo");
        const timeBonus = config.bonus;
        const isLarge = config.isLarge;

        addTimePopUp(timeBonus, isLarge);
      }
    },
    [addTimePopUp],
  );

  const processCorrectHit = useCallback(
    (currentCombo: number) => {
      playSE("type");
      const nextCombo = currentCombo + 1;

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

  // 次はここから
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
      addTimePopUp(GAUGE_CONFIG.RECOVER_SEC, true);
      dispatch({ type: "GAUGE_MAX_REACHED" });
    }
  }, [gaugeValue, gaugeMax, addTimePopUp]);

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;

    return () => {
      timeoutIds.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });

      timeoutIds.clear();
    };
  }, []);

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
