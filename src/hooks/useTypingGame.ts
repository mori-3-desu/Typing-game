/**
 * @file useTypingGame.ts
 * @description タイピングゲームのコアロジックを管理するカスタムフック
 * * NOTE: 本プロジェクトは、AIをメンターとして活用しながら開発を行わせていただきました。
 * コードの意図や技術選定の理由を明確にするため、また未来の自分への備忘録として、
 * あえて詳細にコメントを残しています。
 */
import { useState, useRef, useCallback, useEffect, useReducer } from "react";
import { TypingEngine, Segment } from "./useTypingEngine";
import {
  DIFFICULTY_SETTINGS,
  UI_ANIMATION_CONFIG,
  JUDGE_COLOR,
  SCORE_CONFIG,
  SCORE_DIRECTION,
  GAUGE_CONFIG,
  RANK_THRESHOLDS,
  COMBO_THRESHOLDS,
  SCORE_COMBO_MULTIPLIER,
  COMBO_TIME_BONUS,
} from "../utils/setting";
import { playSE } from "../utils/audio";

import {
  type DifficultyLevel,
  type ScorePopup,
  type BonusPopup,
  type TimePopup,
  type TypedLog,
  type RomaState,
  type PerfectPopup,
  type MissedWord,
  type WordDataMap,
} from "../types";

// --- Helper Functions ---
export const calculateRank = (
  difficulty: DifficultyLevel,
  currentScore: number,
) => {
  const th = RANK_THRESHOLDS[difficulty] || RANK_THRESHOLDS.NORMAL;
  if (currentScore >= th.S) return "S";
  if (currentScore >= th.A) return "A";
  if (currentScore >= th.B) return "B";
  if (currentScore >= th.C) return "C";
  return "D";
};

const getComboClass = (val: number) => {
  if (val >= COMBO_THRESHOLDS.RAINBOW) return "is-rainbow";
  if (val >= COMBO_THRESHOLDS.GOLD) return "is-gold";
  return "";
};

const getScoreMultiplier = (currentCombo: number) => {
  if (currentCombo <= SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_1)
    return SCORE_COMBO_MULTIPLIER.MULTIPLIER_BASE;
  if (currentCombo <= SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_2)
    return SCORE_COMBO_MULTIPLIER.MULTIPLIER_MID;
  if (currentCombo <= SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_3)
    return SCORE_COMBO_MULTIPLIER.MULTIPLIER_HIGH;
  return SCORE_COMBO_MULTIPLIER.MULTIPLIER_MAX;
};

// --- State Definitions ---
interface GameState {
  score: number;
  timeLeft: number;
  elapsedTime: number;
  combo: number;
  maxCombo: number;
  gaugeValue: number;
  gaugeMax: number;
  jpText: string;
  romaState: RomaState;
  allSegments: Segment[];
  correctCount: number;
  missCount: number;
  backspaceCount: number;
  completedWords: number;
  currentWordMiss: number;
  missedWordsRecord: MissedWord[];
  missedCharsRecord: Record<string, number>;
  shakeStatus: "none" | "light" | "error";
  bonusPopups: BonusPopup[];
  scorePopups: ScorePopup[];
  timePopups: TimePopup[];
  perfectPopups: PerfectPopup[];
}

const initialState: GameState = {
  score: 0,
  timeLeft: 0,
  elapsedTime: 0,
  combo: 0,
  maxCombo: 0,
  gaugeValue: 0,
  gaugeMax: GAUGE_CONFIG.INITIAL_MAX,
  jpText: "",
  romaState: { typedLog: [], current: "", remaining: "" },
  allSegments: [],
  correctCount: 0,
  missCount: 0,
  backspaceCount: 0,
  completedWords: 0,
  currentWordMiss: 0,
  missedWordsRecord: [],
  missedCharsRecord: {},
  shakeStatus: "none",
  bonusPopups: [],
  scorePopups: [],
  timePopups: [],
  perfectPopups: [],
};

type GameAction =
  | { type: "RESET"; initialTime: number }
  | {
      type: "LOAD_WORD";
      jp: string;
      romaState: RomaState;
      segments: Segment[];
    }
  | {
      type: "UPDATE_DISPLAY";
      romaState: RomaState;
      segments: Segment[];
    }
  | { type: "TICK"; amount: number } // ★これを使います
  | { type: "ADD_TIME"; sec: number }
  | { type: "ADD_TIME_POPUP"; popup: TimePopup }
  | { type: "REMOVE_TIME_POPUP"; id: number }
  | { type: "HIDE_TIME_ADDED" }
  | { type: "BACKSPACE"; penalty: number }
  | {
      type: "MISS";
      missType: "INPUT" | "COMPLETION";
      charStr?: string;
      penalty: number;
      gaugePenalty: number;
    }
  | { type: "CORRECT_HIT"; addScore: number; gaugeGain: number }
  | { type: "PERFECT_BONUS"; bonus: number }
  | { type: "RECORD_MISSED_WORD"; word: string; misses: number }
  | { type: "GAUGE_MAX_REACHED" }
  | { type: "SET_SHAKE"; status: "none" | "light" | "error" }
  | { type: "ADD_POPUP"; popup: BonusPopup }
  | { type: "REMOVE_POPUP"; id: number }
  | { type: "ADD_SCORE_POPUP"; popup: ScorePopup }
  | { type: "REMOVE_SCORE_POPUP"; id: number }
  | { type: "ADD_PERFECT_POPUP"; popup: PerfectPopup }
  | { type: "REMOVE_PERFECT_POPUP"; id: number };

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "RESET":
      return { ...initialState, timeLeft: action.initialTime };
    case "LOAD_WORD":
      return {
        ...state,
        jpText: action.jp,
        currentWordMiss: 0,
        shakeStatus: "none",
        romaState: action.romaState,
        allSegments: action.segments,
      };
    case "UPDATE_DISPLAY":
      return {
        ...state,
        romaState: action.romaState,
        allSegments: action.segments,
      };
    case "TICK":
      return {
        ...state,
        timeLeft: Math.max(0, state.timeLeft - action.amount),
        elapsedTime: state.elapsedTime + action.amount,
      };
    case "ADD_TIME":
      return {
        ...state,
        timeLeft: state.timeLeft + action.sec,
      };
    case "ADD_TIME_POPUP":
      return {
        ...state,
        timePopups: [...state.timePopups, action.popup],
      };

    case "REMOVE_TIME_POPUP":
      return {
        ...state,
        timePopups: state.timePopups.filter((p) => p.id !== action.id),
      };
    case "BACKSPACE":
      return {
        ...state,
        score: Math.max(0, state.score - action.penalty),
        combo: 0,
        backspaceCount: state.backspaceCount + 1,
        shakeStatus: "none",
      };
    case "MISS": {
      const isInputMiss = action.missType === "INPUT";
      return {
        ...state,
        score: Math.max(0, state.score - action.penalty),
        gaugeValue: Math.max(0, state.gaugeValue - action.gaugePenalty),
        combo: 0,
        shakeStatus: isInputMiss ? "light" : "error",
        missCount: isInputMiss ? state.missCount + 1 : state.missCount,
        currentWordMiss: isInputMiss
          ? state.currentWordMiss + 1
          : state.currentWordMiss,
        missedCharsRecord:
          isInputMiss && action.charStr
            ? {
                ...state.missedCharsRecord,
                [action.charStr]:
                  (state.missedCharsRecord[action.charStr] || 0) + 1,
              }
            : state.missedCharsRecord,
      };
    }
    case "CORRECT_HIT": {
      const nextCombo = state.combo + 1;
      return {
        ...state,
        correctCount: state.correctCount + 1,
        combo: nextCombo,
        maxCombo: Math.max(state.maxCombo, nextCombo),
        score: state.score + action.addScore,
        gaugeValue: state.gaugeValue + action.gaugeGain,
        shakeStatus: "none",
      };
    }
    case "PERFECT_BONUS":
      return {
        ...state,
        score: state.score + action.bonus,
        completedWords: state.completedWords + 1,
      };
    case "RECORD_MISSED_WORD":
      return {
        ...state,
        missedWordsRecord: [
          ...state.missedWordsRecord,
          { word: action.word, misses: action.misses },
        ],
        completedWords: state.completedWords + 1,
      };
    case "GAUGE_MAX_REACHED":
      return {
        ...state,
        gaugeValue: 0,
        gaugeMax: Math.min(
          GAUGE_CONFIG.CEILING,
          state.gaugeMax + GAUGE_CONFIG.INCREMENT,
        ),
      };
    case "SET_SHAKE":
      return { ...state, shakeStatus: action.status };
    case "ADD_POPUP":
      return { ...state, bonusPopups: [...state.bonusPopups, action.popup] };
    case "REMOVE_POPUP":
      return {
        ...state,
        bonusPopups: state.bonusPopups.filter((p) => p.id !== action.id),
      };
    case "ADD_SCORE_POPUP":
      return { ...state, scorePopups: [...state.scorePopups, action.popup] };
    case "REMOVE_SCORE_POPUP":
      return {
        ...state,
        scorePopups: state.scorePopups.filter((p) => p.id !== action.id),
      };
    case "ADD_PERFECT_POPUP":
      return {
        ...state,
        perfectPopups: [...state.perfectPopups, action.popup],
      };
    case "REMOVE_PERFECT_POPUP":
      return {
        ...state,
        perfectPopups: state.perfectPopups.filter((p) => p.id !== action.id),
      };
    default:
      return state;
  }
};

// --- Hook 本体 ---
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
    bonusPopups,
    scorePopups,
    timePopups,
    perfectPopups,
  } = state;

  const rank = calculateRank(difficulty, score);
  const comboClass = getComboClass(combo);
  const isRainbowMode = combo >= COMBO_THRESHOLDS.RAINBOW;
  const currentSpeed =
    elapsedTime > 0.1 ? (correctCount / elapsedTime).toFixed(2) : "0.00";

  // --- Helpers ---
  const addPopup = useCallback(
    (text: string, type: "normal" | "large" | "miss") => {
      popupIdRef.current += 1;
      const newId = popupIdRef.current;
      dispatch({ type: "ADD_POPUP", popup: { id: newId, text, type } });
      setTimeout(
        () => dispatch({ type: "REMOVE_POPUP", id: newId }),
        UI_ANIMATION_CONFIG.POPUP_DURATION_MS,
      );
    },
    [],
  );

  const addScorePopup = useCallback((amount: number) => {
    popupIdRef.current += 1;
    const newId = popupIdRef.current;
    let type: ScorePopup["type"] = "popup-normal";
    if (amount < SCORE_DIRECTION.PENALTY) type = "popup-miss";
    else if (amount >= SCORE_DIRECTION.RAINBOW) type = "popup-rainbow";
    else if (amount >= SCORE_DIRECTION.GOLD) type = "popup-gold";

    dispatch({
      type: "ADD_SCORE_POPUP",
      popup: { id: newId, text: amount > 0 ? `+${amount}` : `${amount}`, type },
    });
    setTimeout(
      () => dispatch({ type: "REMOVE_SCORE_POPUP", id: newId }),
      UI_ANIMATION_CONFIG.POPUP_DURATION_MS,
    );
  }, []);

  const triggerPerfect = useCallback(() => {
    popupIdRef.current += 1;
    const newId = popupIdRef.current;
    dispatch({ type: "ADD_PERFECT_POPUP", popup: { id: newId } });
    setTimeout(
      () => dispatch({ type: "REMOVE_PERFECT_POPUP", id: newId }),
      UI_ANIMATION_CONFIG.POPUP_DURATION_MS,
    );
  }, []);

  const addTime = useCallback((sec: number, isLarge: boolean = false) => {
    // 1. ロジック上の時間を足す（Reducerの ADD_TIME を呼ぶ）
    dispatch({ type: "ADD_TIME", sec });

    // 2. ポップアップを表示リストに追加する（新しいIDを発行）
    popupIdRef.current += 1;
    const newId = popupIdRef.current;

    dispatch({
      type: "ADD_TIME_POPUP",
      popup: { id: newId, text: `+${sec}秒`, isLarge },
    });

    // 3. 一定時間後に、そのIDのポップアップだけ消す
    setTimeout(() => {
      dispatch({ type: "REMOVE_TIME_POPUP", id: newId });
    }, UI_ANIMATION_CONFIG.TIME_DURATION_MS);
  }, []);

  // ★ 新しい時間経過関数
  const tick = useCallback((amount: number) => {
    dispatch({ type: "TICK", amount });
  }, []);

  const updateDisplay = useCallback(() => {
    if (!engineRef.current) return;
    const engine = engineRef.current;
    const newTypedLog: TypedLog[] = [];
    engine.segments.forEach((seg) => {
      seg.typedLog.forEach((log) => newTypedLog.push(log));
    });
    const currentSegIndex = Math.min(
      engine.segIndex,
      engine.segments.length - 1,
    );
    const currentSeg = engine.segments[currentSegIndex];
    const isActuallyFinished = engine.segIndex >= engine.segments.length;

    const nextRomaState = {
      typedLog: newTypedLog,
      current:
        !isActuallyFinished && currentSeg ? currentSeg.getCurrentChar() : "",
      remaining:
        !isActuallyFinished && currentSeg ? currentSeg.getRemaining() : "",
    };
    dispatch({
      type: "UPDATE_DISPLAY",
      romaState: nextRomaState,
      segments: [...engine.segments],
    });
  }, []);

  const loadRandomWord = useCallback(() => {
    // 【1. ガード節】
    // データがまだ読み込まれていない、または空の場合は何もしない（エラー防止）
    if (!wordData) return;
    const list = wordData[difficulty]; // 現在の難易度のリストを取得
    if (!list || list.length === 0) return;

    let nextWord;

    // 【2. 要素数が1つしかない場合の処理】
    // フィルターをかけると空になってしまうため、特例としてそのまま使う
    if (list.length === 1) {
      nextWord = list[0];
    } else {
      // NOTE: 重複排除のロジック (Deduplication Logic)
      // 直前の単語（prevWordRef.current）以外のリストを新しく作る。
      // これにより、ランダム抽選の候補から物理的に「前の単語」を消す。

      // TODO: 将来的なパフォーマンス改善 (Performance Optimization)
      // 現在は Array.filter を使用しているため、計算量は O(N) です。
      // 現在の単語数（数千件）では問題ありませんが、将来的に単語数が10万件を超える場合、
      // 処理落ち（フレームドロップ）の原因になる可能性があります。
      // その際は、「Bag System（テトリス方式）」や「インデックス管理」への移行を検討してください。
      const candidates = list.filter((word) => word.jp !== prevWordRef.current);

      // (保険) もし何らかのバグで候補が空なら、元のリストを使う
      const targetList = candidates.length > 0 ? candidates : list;

      // 【4. ランダム抽選】
      // 0 〜 (リストの長さ - 1) の乱数を生成し、それを使って単語を取得
      const randomIndex = Math.floor(Math.random() * targetList.length);
      nextWord = targetList[randomIndex];
    }

    // 【5. 履歴の更新】
    // 選ばれた単語を「前回の単語」として記録（次回の除外対象になる）
    prevWordRef.current = nextWord.jp;

    // 【6. タイピングエンジンの初期化】
    // 選ばれた単語のローマ字データを使って、判定ロジック（Class）を生成
    engineRef.current = new TypingEngine(nextWord.roma);

    // 【7. 初期表示データの作成】
    // エンジンから最初の文字情報を取得し、Reactのstateに渡す準備
    // （まだ一文字も打っていない状態を作る）
    let initialRomaState = { typedLog: [], current: "", remaining: "" };
    if (engineRef.current.segments.length > 0) {
      const firstSeg = engineRef.current.segments[0];
      initialRomaState = {
        typedLog: [],
        current: firstSeg.getCurrentChar(),
        remaining: firstSeg.getRemaining(),
      };
    }

    // 【8. 画面更新（Dispatch）】
    // Reducerに対して「新しい単語をロードせよ」と命令を送る
    dispatch({
      type: "LOAD_WORD",
      jp: nextWord.jp,
      romaState: initialRomaState,
      segments: [...engineRef.current.segments],
    });
  }, [difficulty, wordData]); // 難易度かデータが変わった時だけ関数を作り直す

  const resetGame = useCallback(() => {
    dispatch({
      type: "RESET",
      initialTime: DIFFICULTY_SETTINGS[difficulty].time,
    });
    setDisplayScore(0);
    prevWordRef.current = null;
  }, [difficulty]);

  const startGame = useCallback(() => {
    loadRandomWord();
  }, [loadRandomWord]);

  const handleBackspace = useCallback(() => {
    if (!engineRef.current) return;
    playSE("bs");
    engineRef.current.backspace();
    dispatch({ type: "BACKSPACE", penalty: SCORE_CONFIG.BACKSPACE_PENALTY });
    addScorePopup(-SCORE_CONFIG.BACKSPACE_PENALTY);
    updateDisplay();
  }, [updateDisplay, addScorePopup]);

  const processMiss = useCallback(
    (missType: "INPUT" | "COMPLETION", charStr?: string) => {
      playSE("miss");
      setTimeout(
        () => dispatch({ type: "SET_SHAKE", status: "none" }),
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
    [addScorePopup],
  );

  const processCorrectHit = useCallback(
    (currentCombo: number) => {
      playSE("type");
      const nextCombo = currentCombo + 1;
      let timeBonus = 0;
      let isLarge = false;

      if (nextCombo <= COMBO_TIME_BONUS.THRESHOLDS_LEVEL_1) {
        if (
          nextCombo > 0 &&
          nextCombo % COMBO_TIME_BONUS.INTERVAL_LEVEL_1 === 0
        )
          timeBonus = COMBO_TIME_BONUS.BONUS_BASE_SEC;
      } else if (nextCombo <= COMBO_TIME_BONUS.THRESHOLDS_LEVEL_2) {
        if (nextCombo % COMBO_TIME_BONUS.INTERVAL_LEVEL_2 === 0)
          timeBonus = COMBO_TIME_BONUS.BONUS_MID_SEC;
      } else {
        if (nextCombo % COMBO_TIME_BONUS.INTERVAL_LEVEL_3 === 0) {
          timeBonus = COMBO_TIME_BONUS.BONUS_MAX_SEC;
          isLarge = true;
        }
      }

      if (timeBonus > 0) {
        playSE("combo");
        addTime(timeBonus, isLarge);
      }
      const multiplier = getScoreMultiplier(nextCombo);
      const addScore = SCORE_CONFIG.BASE_POINT * multiplier;

      dispatch({ type: "CORRECT_HIT", addScore, gaugeGain: GAUGE_CONFIG.GAIN });
      addScorePopup(addScore);
    },
    [addTime, addScorePopup],
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
      updateDisplay();
      if (engine.segIndex >= engine.segments.length) {
        processWordCompletion();
      }
    },
    [
      combo,
      processMiss,
      processCorrectHit,
      processWordCompletion,
      updateDisplay,
    ],
  );

  useEffect(() => {
    if (gaugeValue >= gaugeMax) {
      playSE("gauge");
      addTime(GAUGE_CONFIG.RECOVER_SEC, true);
      dispatch({ type: "GAUGE_MAX_REACHED" });
    }
  }, [gaugeValue, gaugeMax, addTime]);

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
    backspaceCount,
    jpText,
    romaState,
    allSegments,
    shakeStatus,
    missedWordsRecord,
    missedCharsRecord,
    isRainbowMode,
    bonusPopups,
    perfectPopups,
    scorePopups,
    timePopups,
    handleKeyInput,
    handleBackspace,
    startGame,
    resetGame,
    tick, // ★ここに setTimeLeft, setElapsedTime の代わりに tick を追加
    currentSpeed,
    addPopup,
  };
};
