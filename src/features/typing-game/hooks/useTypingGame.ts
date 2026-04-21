import { useCallback, useEffect, useReducer, useRef, useState } from "react";

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
import { Segment, TypingEngine } from "../logic/typingEngine";
import { calcHitScore, calculateRank, decideScoreType, getComboClass } from "../utils/gameUtils";

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

export const useTypingGame = (
  difficulty: DifficultyLevel,
  wordData: WordDataMap | null,
) => {
  const [state, dispatch] = useReducer(gameReducer, {
    ...initialState,
    timeLeft: DIFFICULTY_SETTINGS[difficulty].time,
  });

  const [displayScore, setDisplayScore] = useState(0);

  const engineRef = useRef<TypingEngine | null>(null);
  const prevWordRef = useRef<string | null>(null);
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

  // 新しい時間経過関数
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
      // ★重要テクニック:
      // engine.segments をそのまま渡すと「参照」が変わらないためReactが変更を無視する可能性がある。
      // [...Array] (スプレッド構文) で「新しい配列」としてコピーして渡すことで、
      // 確実に再レンダリング（色が変わるなど）をトリガーさせる。
      segments: [...engineRef.current.segments],
    });
  }, []);

  // todo: 責務が多い（単語選択・重複排除・エンジン初期化・初期状態生成・dispatch）
  // selectNextWord（純粋関数）/ initializeEngine / dispatch の3段階に分離を検討したい
  const loadRandomWord = useCallback(() => {
    // データ未ロード時の安全策
    if (!wordData) return;
    const list = wordData[difficulty];
    if (!list || list.length === 0) return;

    let nextWord;

    // 【2. 重複排除ロジック (Deduplication)】
    // 「さっき打った単語がまた出てきた」というUX低下を防ぐ処理
    if (list.length === 1) {
      // リストが1個しかないなら、それを使うしかない
      nextWord = list[0];
    } else {
      // 直前の単語 (prevWordRef) と同じものを候補から外す
      // filter計算量は O(N)。単語数が数千件レベルなら一瞬なので問題なし。
      const candidates = list.filter((word) => word.jp !== prevWordRef.current);

      // (保険) バグ等で候補が空になったら元のリストを使う
      const targetList = candidates.length > 0 ? candidates : list;

      // 【3. ランダム抽選】
      const randomIndex = Math.floor(Math.random() * targetList.length);
      nextWord = targetList[randomIndex];
    }

    // 【4. 履歴の更新】
    // 今選んだ単語を記録しておき、次回の抽選で除外できるようにする
    prevWordRef.current = nextWord.jp;

    const currentConfig = DIFFICULTY_SETTINGS[difficulty]; // 先ずは設定を取り出す
    const isEnglishMode = currentConfig.isEnglish ?? false; // 上記のイングリッシュフラグを代入する

    // 【5. エンジンの再インスタンス化 (Re-instantiation)】
    // 新しい単語のローマ字を渡し、判定ロジック(Class)を新品にする。
    // これにより、前の単語の入力履歴などはすべてリセットされる。
    // 更に上記のisEnglishモードでtrueなら英語(ローマ字判定解除)モードに
    engineRef.current = new TypingEngine(nextWord.roma, isEnglishMode);

    // 【6. 初期状態の作成】
    // まだ一文字も打っていない状態（1文字目がターゲット）のデータを作る
    let initialRomaState = { typedLog: [], current: "", remaining: "" };
    if (engineRef.current.segments.length > 0) {
      const firstSeg = engineRef.current.segments[0];
      initialRomaState = {
        typedLog: [],
        current: firstSeg.getCurrentChar(), // 例: "k"
        remaining: firstSeg.getRemaining(), // 例: "a"
      };
    }

    // 【7. 画面への反映】
    // Reducerに「新しい単語になったよ！初期状態はこれだよ！」と伝える
    dispatch({
      type: "LOAD_WORD",
      jp: nextWord.jp,
      romaState: initialRomaState,
      segments: [...engineRef.current.segments],
    });
  }, [difficulty, wordData]); // 難易度かデータが変わった時だけ関数を作り直す

  // todo: startGame / resetGame はタイピング判定・スコア計算とは層が違うフロー制御
  // useGameFlow のような専用フックへの切り出しを検討したい
  const resetGame = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current.clear();

    dispatch({
      type: "RESET",
      initialTime: DIFFICULTY_SETTINGS[difficulty].time,
    });
    setDisplayScore(0);
    prevWordRef.current = null;
  }, [difficulty]);

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

  const processWordCompletion = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const allGreen = engine.segments.every((s) =>
      s.typedLog.every((t) => t.color === JUDGE_COLOR.CORRECT),
    );

    if (allGreen) {
      playSE("correct");
      if (currentWordMiss === 0) {
        const wordLength = engine.segments.reduce(
          (acc, s) => acc + s.display.length,
          0,
        );
        const bonus = wordLength * SCORE_CONFIG.PERFECT_BONUS_CHAR_REN;
        dispatch({ type: "PERFECT_BONUS", bonus });
        addScorePopup(bonus);
        triggerPerfect();
      } else {
        dispatch({
          type: "RECORD_MISSED_WORD",
          word: jpText,
          misses: currentWordMiss,
        });
      }
      loadRandomWord();
    } else {
      processMiss("COMPLETION");
    }
  }, [
    currentWordMiss,
    jpText,
    loadRandomWord,
    processMiss,
    addScorePopup,
    triggerPerfect,
  ]);

  const handleKeyInput = useCallback(
    (key: string) => {
      if (!engineRef.current) return;
      const engine = engineRef.current;
      if (engine.segIndex >= engine.segments.length) {
        const allGreen = engine.segments.every((s) =>
          s.typedLog.every((t) => t.color === JUDGE_COLOR.CORRECT),
        );
        if (!allGreen) {
          processMiss("COMPLETION");
          return;
        }
      }
      let targetChar = "";
      if (engine.segments[engine.segIndex]) {
        targetChar = engine.segments[engine.segIndex].getCurrentChar();
      }
      const result = engine.input(key);

      if (result.status.startsWith("MISS")) {
        processMiss("INPUT", targetChar);
      } else if (["OK", "NEXT", "EXPANDED"].includes(result.status)) {
        processCorrectHit(combo);
      }
      syncEngineToReact();
      if (engine.segIndex >= engine.segments.length) {
        processWordCompletion();
      }
    },
    [
      combo,
      processMiss,
      processCorrectHit,
      processWordCompletion,
      syncEngineToReact,
    ],
  );

  useEffect(() => {
    if (gaugeValue >= gaugeMax) {
      playSE("gauge");
      addTimePopUp(GAUGE_CONFIG.RECOVER_SEC, true);
      dispatch({ type: "GAUGE_MAX_REACHED" });
    }
  }, [gaugeValue, gaugeMax, addTimePopUp]);

  // ※こちらは内部でクリーンアップ完結しているのでそのまま
  useEffect(() => {
    if (displayScore !== score) {
      const diff = score - displayScore;
      const easing = UI_ANIMATION_CONFIG.SCORE_EASING;

      const step =
        Math.abs(diff) < easing
          ? diff > 0
            ? 1
            : -1
          : Math.ceil(diff / easing);

      const timer = setTimeout(() => {
        setDisplayScore((prev) => prev + step);
      }, UI_ANIMATION_CONFIG.SCORE_FLUCTUATION_MS);

      return () => clearTimeout(timer);
    }
  }, [score, displayScore]);

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
