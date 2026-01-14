import { useState, useRef, useCallback, useEffect } from "react";
import { TypingEngine, Segment } from "./useTypingEngine";
import {
  type DifficultyLevel,
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
import {
  playTypeSound,
  playMissSound,
  playCorrectSound,
  playGaugeSound,
  playComboSound,
  playBsSound,
} from "../utils/audio";

type MissedWord = { word: string; misses: number };
type TypedLog = { char: string; color: string };
type BonusPopup = {
  id: number;
  text: string;
  type: "normal" | "large" | "miss";
};
type ScorePopup = {
  id: number;
  text: string;
  type: "popup-normal" | "popup-gold" | "popup-rainbow" | "popup-miss";
};
type PerfectPopup = { id: number };
export type WordDataMap = Record<string, { jp: string; roma: string }[]>;

// ランク計算
export const calculateRank = (
  difficulty: DifficultyLevel,
  currentScore: number
) => {
  const th = RANK_THRESHOLDS[difficulty] || RANK_THRESHOLDS.NORMAL;
  if (currentScore >= th.S) return "S";
  if (currentScore >= th.A) return "A";
  if (currentScore >= th.B) return "B";
  if (currentScore >= th.C) return "C";
  return "D";
};

// コンボ数に応じたクラス名
const getComboClass = (val: number) => {
  if (val >= COMBO_THRESHOLDS.RAINBOW) return "is-rainbow";
  if (val >= COMBO_THRESHOLDS.GOLD) return "is-gold";
  return "";
};

// コンボ数に応じたスコア倍率
const getScoreMultiplier = (currentCombo: number) => {
  if (currentCombo <= SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_1)
    return SCORE_COMBO_MULTIPLIER.MULTIPLIER_BASE;
  if (currentCombo <= SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_2)
    return SCORE_COMBO_MULTIPLIER.MULTIPLIER_MID;
  if (currentCombo <= SCORE_COMBO_MULTIPLIER.THRESHOLDS_LEVEL_3)
    return SCORE_COMBO_MULTIPLIER.MULTIPLIER_HIGH;
  return SCORE_COMBO_MULTIPLIER.MULTIPLIER_MAX;
};

export const useTypingGame = (
  difficulty: DifficultyLevel,
  wordData: WordDataMap | null
) => {
  // ゲーム進行ステート
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0); // 表示用アニメーションスコア
  const [timeLeft, setTimeLeft] = useState(
    DIFFICULTY_SETTINGS[difficulty].time
  );
  const [elapsedTime, setElapsedTime] = useState(0); // 経過時間(速度計算用)
  const [isTimeAdded, setIsTimeAdded] = useState(false); // 時計アイコンの演出用

  // コンボ & ゲージ
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [gaugeValue, setGaugeValue] = useState(0);
  const [gaugeMax, setGaugeMax] = useState(GAUGE_CONFIG.INITIAL_MAX);

  // 入力エンジン & テキスト管理
  const engineRef = useRef<TypingEngine | null>(null);
  const prevWordRef = useRef<string | null>(null); // 同じ単語の連続出題防止
  const [jpText, setJpText] = useState("");
  const [allSegments, setAllSegments] = useState<Segment[]>([]);
  const [romaState, setRomaState] = useState<{
    typedLog: TypedLog[];
    current: string;
    remaining: string;
  }>({ typedLog: [], current: "", remaining: "" });

  // 統計データ
  const [correctCount, setCorrectCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [completedWords, setCompletedWords] = useState(0);

  // 苦手指標用
  const [currentWordMiss, setCurrentWordMiss] = useState(0);
  const [missedWordsRecord, setMissedWordsRecord] = useState<MissedWord[]>([]);
  const [missedCharsRecord, setMissedCharsRecord] = useState<
    Record<string, number>
  >({});

  // 演出・UIステート
  const [shakeStatus, setShakeStatus] = useState<"none" | "light" | "error">(
    "none"
  );
  const [bonusPopups, setBonusPopups] = useState<BonusPopup[]>([]);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [perfectPopups, setPerfectPopups] = useState<PerfectPopup[]>([]);

  // ランクはスコアから自動計算
  const rank = calculateRank(difficulty, score);

  // コンボクラスも自動計算
  const comboClass = getComboClass(combo);

  // レインボーモードも「コンボが200以上」ならTrue、そうでなければFalse
  const isRainbowMode = combo >= COMBO_THRESHOLDS.RAINBOW;

  // 現在の入力速度 (miss、backspaseは反映されないように設定する)
  const currentSpeed =
    elapsedTime > 0.1 ? (correctCount / elapsedTime).toFixed(2) : "0.00";

  // 汎用のポップアップ追加関数
  const addPopup = useCallback(
    (text: string, type: "normal" | "large" | "miss") => {
      const newPopup: BonusPopup = {
        id: Date.now() + Math.random(),
        text: text,
        type: type,
      };
      setBonusPopups((prev) => [...prev, newPopup]);

      // 1秒後に自動削除
      setTimeout(() => {
        setBonusPopups((prev) => prev.filter((p) => p.id !== newPopup.id));
      }, UI_ANIMATION_CONFIG.POPUP_DURATION_MS);
    },
    []
  );

  // 時間追加 (addPopup を再利用して短縮！)
  const addTime = useCallback(
    (sec: number, isLarge: boolean = false) => {
      // ロジック部分
      setTimeLeft((t) => t + sec);
      setIsTimeAdded(true);
      setTimeout(
        () => setIsTimeAdded(false),
        UI_ANIMATION_CONFIG.TIME_DURATION_MS
      );

      // 表示部分 (addPopupに丸投げ！)
      addPopup(`+${sec}秒`, isLarge ? "large" : "normal");
    },
    [addPopup]
  ); // 依存配列に addPopup を追加

  // スコア追加 (操作する配列が違うので独立のまま)
  const addScorePopup = useCallback((amount: number) => {
    let type: ScorePopup["type"] = "popup-normal";
    if (amount < SCORE_DIRECTION.PENALTY) type = "popup-miss";
    else if (amount >= SCORE_DIRECTION.RAINBOW) type = "popup-rainbow";
    else if (amount >= SCORE_DIRECTION.GOLD) type = "popup-gold";

    // データの重複を防ぐためにIDにランダムな乱数を追加(ユニークにしないとsetTimeoutで消すときに出したばかりのポップアップまで消える為)
    const newP: ScorePopup = {
      id: Date.now() + Math.random(), // ここでデータが衝突しないようランダムな乱数を追加する
      text: amount > 0 ? `+${amount}` : `${amount}`,
      type,
    };
    setScorePopups((prev) => [...prev, newP]);
    setTimeout(
      () => setScorePopups((prev) => prev.filter((p) => p.id !== newP.id)),
      UI_ANIMATION_CONFIG.POPUP_DURATION_MS
    );
  }, []);

  // ミスなく単語を入力した際に表示する
  const triggerPerfect = useCallback(() => {
    const newP: PerfectPopup = { id: Date.now() };
    setPerfectPopups((prev) => [...prev, newP]);
    setTimeout(
      () => setPerfectPopups((prev) => prev.filter((p) => p.id !== newP.id)),
      UI_ANIMATION_CONFIG.POPUP_DURATION_MS
    );
  }, []);

  // 判定ローマ字と参考ローマ字の現在地管理
  const updateDisplay = useCallback(() => {
    // 判定用ローマ字(上)
    if (!engineRef.current) return;
    const engine = engineRef.current;

    const newTypedLog: TypedLog[] = [];
    engine.segments.forEach((seg) => {
      seg.typedLog.forEach((log) => newTypedLog.push(log));
    });

    const currentSegIndex = Math.min(
      engine.segIndex,
      engine.segments.length - 1
    ); // 一個前の要素を取得
    const currentSeg = engine.segments[currentSegIndex];
    const isActuallyFinished = engine.segIndex >= engine.segments.length; // 指定以上の入力を受け付けないようにする

    //参考ローマ字(下)
    setRomaState({
      typedLog: newTypedLog,
      current:
        !isActuallyFinished && currentSeg ? currentSeg.getCurrentChar() : "",
      remaining:
        !isActuallyFinished && currentSeg ? currentSeg.getRemaining() : "",
    });
    setAllSegments([...engine.segments]);
  }, []);

  const loadRandomWord = useCallback(() => {
    if (!wordData) return;

    const list = wordData[difficulty];
    if (!list || list.length === 0) return;

    let nextWord;
    if (list.length === 1) {
      nextWord = list[0];
    } else {
      // 同じ単語が連続で出現したら再抽選
      let attempts = 0;
      do {
        nextWord = list[Math.floor(Math.random() * list.length)];
        attempts++;
      } while (nextWord.jp === prevWordRef.current && attempts < 10);
    }
    prevWordRef.current = nextWord.jp;

    engineRef.current = new TypingEngine(nextWord.roma);
    setJpText(nextWord.jp);
    setCurrentWordMiss(0);
    setShakeStatus("none");

    // 全て空にする
    if (engineRef.current.segments.length > 0) {
      const firstSeg = engineRef.current.segments[0];
      setRomaState({
        typedLog: [],
        current: firstSeg.getCurrentChar(),
        remaining: firstSeg.getRemaining(),
      });
      setAllSegments([...engineRef.current.segments]);
    }
  }, [difficulty, wordData]);

  const resetGame = useCallback(() => {
    setScore(0);
    setDisplayScore(0);
    setCombo(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setMissCount(0);
    setCompletedWords(0);
    setBackspaceCount(0);
    setGaugeValue(0);
    setGaugeMax(GAUGE_CONFIG.INITIAL_MAX);
    setMissedWordsRecord([]);
    setMissedCharsRecord({});
    setTimeLeft(DIFFICULTY_SETTINGS[difficulty].time);
    setElapsedTime(0);
    // currentSpeed, isRainbowMode は自動計算なのでリセット不要（依存元の変数をリセットすればOK）
    setIsTimeAdded(false);
    setBonusPopups([]);
    setScorePopups([]);
    setPerfectPopups([]);
    prevWordRef.current = null;
  }, [difficulty]);

  const startGame = useCallback(() => {
    loadRandomWord();
  }, [loadRandomWord]);

  const handleBackspace = useCallback(() => {
    if (!engineRef.current) return;
    playBsSound();
    engineRef.current.backspace();

    setScore((s) => Math.max(0, s - SCORE_CONFIG.BACKSPACE_PENALTY));
    addScorePopup(-SCORE_CONFIG.BACKSPACE_PENALTY);
    setBackspaceCount((c) => c + 1);

    updateDisplay();
    setShakeStatus("none");
  }, [updateDisplay, addScorePopup]);

  const handleKeyInput = useCallback(
    (key: string) => {
      if (!engineRef.current) return;
      const engine = engineRef.current;

      const isFinished = engine.segIndex >= engine.segments.length;
      if (isFinished) {
        const allGreen = engine.segments.every((s) =>
          s.typedLog.every((t) => t.color === JUDGE_COLOR.CORRECT)
        );
        if (!allGreen) {
          // ミスが含まれてたら次に進ませない
          playMissSound();
          setShakeStatus("error");
          setTimeout(
            () => setShakeStatus("none"),
            UI_ANIMATION_CONFIG.NO_ALLGREEN_DURATION_MS
          );

          setScore((s) => Math.max(0, s - SCORE_CONFIG.MISS_PENALTY));
          addScorePopup(-SCORE_CONFIG.MISS_PENALTY);
          setGaugeValue((g) => Math.max(0, g - GAUGE_CONFIG.PENALTY));
          setMissCount((c) => c + 1);
          setCombo(0);
          return;
        }
      }

      let targetChar = "";
      if (engine.segments[engine.segIndex]) {
        targetChar = engine.segments[engine.segIndex].getCurrentChar();
      }

      const result = engine.input(key);

      // ミスした場合の処理
      if (
        result.status === "MISS" ||
        result.status === "MISS_ADVANCE" ||
        result.status === "MISS_NEXT"
      ) {
        playMissSound();
        setMissCount((c) => c + 1);
        setCurrentWordMiss((c) => c + 1);
        setCombo(0); // コンボリセット→自動的にRainbowも解除

        setShakeStatus("light");
        setTimeout(
          () => setShakeStatus("none"),
          UI_ANIMATION_CONFIG.MISS_DURATION_MS
        );

        setGaugeValue((g) => Math.max(0, g - GAUGE_CONFIG.PENALTY));
        setScore((s) => Math.max(0, s - SCORE_CONFIG.MISS_PENALTY));
        addScorePopup(-SCORE_CONFIG.MISS_PENALTY);

        if (targetChar) {
          setMissedCharsRecord((prev) => ({
            ...prev,
            [targetChar]: (prev[targetChar] || 0) + 1,
          }));
        }
      }

      // 正解時の処理
      if (
        result.status === "OK" ||
        result.status === "NEXT" ||
        result.status === "EXPANDED"
      ) {
        setShakeStatus("none");
        playTypeSound();
        setCorrectCount((c) => c + 1);

        const nextCombo = combo + 1;
        setCombo(nextCombo);
        if (nextCombo > maxCombo) setMaxCombo(nextCombo);

        let timeBonus = COMBO_TIME_BONUS.INIT_BONUS_SEC;
        let isLarge = false;
        if (nextCombo <= COMBO_TIME_BONUS.THRESHOLDS_LEVEL_1) {
          if (
            nextCombo > 0 &&
            nextCombo % COMBO_TIME_BONUS.INTERVAL_LEVEL_1 === 0
          )
            timeBonus = COMBO_TIME_BONUS.BONUS_BASE_SEC;
        } else if (nextCombo <= COMBO_TIME_BONUS.THRESHOLDS_LEVEL_2) {
          if (
            (nextCombo - COMBO_TIME_BONUS.THRESHOLDS_LEVEL_1) %
              COMBO_TIME_BONUS.INTERVAL_LEVEL_2 ===
            0
          ) {
            timeBonus = COMBO_TIME_BONUS.BONUS_MID_SEC;
            isLarge = false;
          }
        } else {
          if (
            (nextCombo - COMBO_TIME_BONUS.THRESHOLDS_LEVEL_2) %
              COMBO_TIME_BONUS.INTERVAL_LEVEL_3 ===
            0
          ) {
            timeBonus = COMBO_TIME_BONUS.BONUS_MAX_SEC;
            isLarge = true;
          }
        }

        if (timeBonus > 0) {
          playComboSound(); //Comboだとわかりづらいから変更します
          addTime(timeBonus, isLarge);
        }

        const basePoint = SCORE_CONFIG.BASE_POINT;
        const multiplier = getScoreMultiplier(nextCombo);
        const addScore = basePoint * multiplier;

        setScore((s) => s + addScore);
        addScorePopup(addScore);

        setGaugeValue((prev) => prev + GAUGE_CONFIG.GAIN);
      }

      updateDisplay();

      const currentIsFinished = engine.segIndex >= engine.segments.length;
      if (currentIsFinished) {
        const allGreen = engine.segments.every((s) =>
          s.typedLog.every((t) => t.color === JUDGE_COLOR.CORRECT)
        );

        if (allGreen) {
          playCorrectSound();
          setCompletedWords((c) => c + 1);

          if (currentWordMiss === 0) {
            // ミスなく単語を打てたら文字列ボーナス付与
            const wordLength = engine.segments.reduce(
              (acc, s) => acc + s.display.length,
              0
            );
            const bonus = wordLength * SCORE_CONFIG.PERFECT_BONUS_CHAR_REN;
            setScore((s) => s + bonus);
            addScorePopup(bonus);
            triggerPerfect();
          }

          if (currentWordMiss > 0) {
            setMissedWordsRecord((prev) => [
              ...prev,
              { word: jpText, misses: currentWordMiss },
            ]);
          }
          loadRandomWord();
        } else {
          playMissSound();
          setShakeStatus("error");
          setTimeout(
            () => setShakeStatus("none"),
            UI_ANIMATION_CONFIG.NO_ALLGREEN_DURATION_MS
          );

          setScore((s) => Math.max(0, s - SCORE_CONFIG.MISS_PENALTY));
          addScorePopup(-SCORE_CONFIG.MISS_PENALTY);
          setGaugeValue((g) => Math.max(0, g - GAUGE_CONFIG.PENALTY));
          setCombo(0);
        }
      }
    },
    [
      combo,
      maxCombo,
      jpText,
      currentWordMiss,
      loadRandomWord,
      updateDisplay,
      addTime,
      addScorePopup,
      triggerPerfect,
    ]
  );

  // 連打ゲージ
  useEffect(() => {
    if (gaugeValue >= gaugeMax) {
      playGaugeSound();
      addTime(GAUGE_CONFIG.RECOVER_SEC, true);
      setGaugeValue(0);
      setGaugeMax((prev) =>
        Math.min(GAUGE_CONFIG.CEILING, prev + GAUGE_CONFIG.INCREMENT)
      );
    }
  }, [gaugeValue, gaugeMax, addTime]);

  // スコア表示
  useEffect(() => {
    if (displayScore !== score) {
      const diff = score - displayScore;
      const easing = UI_ANIMATION_CONFIG.SCORE_EASING;
      const step =
        // ここで差分に応じてダイヤル式に増減させてる
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
    isTimeAdded,
    isRainbowMode,
    bonusPopups,
    perfectPopups,
    scorePopups,
    handleKeyInput,
    handleBackspace,
    startGame,
    resetGame,
    setTimeLeft,
    setElapsedTime,
    currentSpeed,
    addPopup,
  };
};
