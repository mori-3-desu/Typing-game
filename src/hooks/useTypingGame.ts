import { useState, useRef, useCallback, useEffect } from "react";
import { TypingEngine, Segment } from "./useTypingEngine";
import { type DifficultyLevel, DIFFICULTY_SETTINGS } from "../utils/setting";
import {
  playTypeSound,
  playMissSound,
  playCorrectSound,
  playGaugeSound,
  playComboSound,
  playBsSound,
} from "../utils/audio";
import { GAUGE_CONFIG } from "../utils/setting";

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

const RANK_THRESHOLDS = {
  // ミスなく継続すれば比較的簡単に到達するのでランク追加したりで調整予定
  EASY: { S: 500000, A: 250000, B: 125000, C: 50000 },
  NORMAL: { S: 900000, A: 500000, B: 300000, C: 150000 },
  HARD: { S: 1300000, A: 800000, B: 500000, C: 250000 },
};

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
  if (val >= 200) return "is-rainbow";
  if (val >= 100) return "is-gold";
  return "";
};

// コンボ数に応じたスコア倍率
const getScoreMultiplier = (currentCombo: number) => {
  if (currentCombo <= 50) return 1;
  if (currentCombo <= 100) return 2;
  if (currentCombo <= 200) return 4;
  return 10;
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
  const [gaugeMax, setGaugeMax] = useState(150);

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
  const isRainbowMode = combo >= 200;

  // 現在の入力速度 (miss、backspaseは反映されないように設定する)
  const currentSpeed =
    elapsedTime > 0.1 ? (correctCount / elapsedTime).toFixed(2) : "0.00";

  // 汎用のポップアップ追加関数 (これをマスターにする)
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
      }, 1000);
    },
    []
  );

  // 時間追加 (addPopup を再利用して短縮！)
  const addTime = useCallback(
    (sec: number, isLarge: boolean = false) => {
      // ロジック部分
      setTimeLeft((t) => t + sec);
      setIsTimeAdded(true);
      setTimeout(() => setIsTimeAdded(false), 500);

      // 表示部分 (addPopupに丸投げ！)
      addPopup(`+${sec}秒`, isLarge ? "large" : "normal");
    },
    [addPopup]
  ); // 依存配列に addPopup を追加

  // スコア追加 (操作する配列が違うので独立のまま)
  const addScorePopup = useCallback((amount: number) => {
    let type: ScorePopup["type"] = "popup-normal";
    if (amount < 0) type = "popup-miss";
    else if (amount >= 10000) type = "popup-rainbow";
    else if (amount > 1000) type = "popup-gold";

    const newP: ScorePopup = {
      id: Date.now() + Math.random(),
      text: amount > 0 ? `+${amount}` : `${amount}`,
      type,
    };
    setScorePopups((prev) => [...prev, newP]);
    setTimeout(
      () => setScorePopups((prev) => prev.filter((p) => p.id !== newP.id)),
      1000
    );
  }, []);

  // ミスなく単語を入力した際に表示する
  const triggerPerfect = useCallback(() => {
    const newP: PerfectPopup = { id: Date.now() };
    setPerfectPopups((prev) => [...prev, newP]);
    setTimeout(
      () => setPerfectPopups((prev) => prev.filter((p) => p.id !== newP.id)),
      1000
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
    setGaugeMax(150);
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

    setScore((s) => Math.max(0, s - 1000));
    addScorePopup(-1000);
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
          s.typedLog.every((t) => t.color === "#4aff50")
        );
        if (!allGreen) {
          // ミスが含まれてたら次に進ませない
          playMissSound();
          setShakeStatus("error");
          setTimeout(() => setShakeStatus("none"), 400);

          setScore((s) => Math.max(0, s - 300));
          addScorePopup(-300);
          setGaugeValue((g) => Math.max(0, g - 20));
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
        setTimeout(() => setShakeStatus("none"), 200);

        setGaugeValue((g) => Math.max(0, g - 20));
        setScore((s) => Math.max(0, s - 300));
        addScorePopup(-300);

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

        let timeBonus = 0;
        let isLarge = false;
        if (nextCombo <= 100) {
          if (nextCombo > 0 && nextCombo % 20 === 0) timeBonus = 1;
        } else if (nextCombo <= 200) {
          if ((nextCombo - 100) % 25 === 0) {
            timeBonus = 3;
            isLarge = false;
          }
        } else {
          if ((nextCombo - 200) % 30 === 0) {
            timeBonus = 5;
            isLarge = true;
          }
        }

        if (timeBonus > 0) {
          playComboSound(); //Comboだとわかりづらいから変更します
          addTime(timeBonus, isLarge);
        }

        const basePoint = 100;
        const multiplier = getScoreMultiplier(nextCombo);
        const addScore = basePoint * multiplier;

        setScore((s) => s + addScore);
        addScorePopup(addScore);

        setGaugeValue((prev) => prev + 1);
      }

      updateDisplay();

      const currentIsFinished = engine.segIndex >= engine.segments.length;
      if (currentIsFinished) {
        const allGreen = engine.segments.every((s) =>
          s.typedLog.every((t) => t.color === "#4aff50")
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
            const bonus = wordLength * 500;
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
          setTimeout(() => setShakeStatus("none"), 400);

          setScore((s) => Math.max(0, s - 300));
          addScorePopup(-300);
          setGaugeValue((g) => Math.max(0, g - 20));
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
      const step =
        Math.abs(diff) < 5 ? (diff > 0 ? 1 : -1) : Math.ceil(diff / 5);
      const timer = setTimeout(() => {
        setDisplayScore((prev) => prev + step);
      }, 16);
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
