import { useState, useRef, useCallback, useEffect } from 'react';
import { TypingEngine, Segment } from './useTypingEngine'; 
import { type DifficultyLevel, DIFFICULTY_SETTINGS } from '../utils/setting';
import { 
  playTypeSound, playMissSound, playCorrectSound, playGaugeSound, playComboSound, 
  playBsSound
} from '../utils/audio';

// ... (型定義などは変更なし) ...
export type MissedWord = { word: string; misses: number };
export type TypedLog = { char: string; color: string };
export type BonusPopup = { id: number; text: string; type: 'normal' | 'large' | 'miss' };
export type ScorePopup = { id: number; text: string; type: 'popup-normal' | 'popup-gold' | 'popup-rainbow' | 'popup-miss' };
export type PerfectPopup = { id: number }; 

// ★追加: データ型の定義
export type WordItem = { jp: string; roma: string };
export type WordDataMap = Record<string, WordItem[]>;

export const RANK_THRESHOLDS = {
    EASY:   { S: 500000,  A: 250000, B: 125000, C: 50000 },
    NORMAL: { S: 900000,  A: 500000, B: 300000, C: 150000 },
    HARD:   { S: 1300000, A: 800000, B: 500000, C: 250000 }
};

// ▼ 新しく計算だけの関数を作って 'export' します（getRankの中身をここに移動）
export const calculateRank = (difficulty: DifficultyLevel, currentScore: number) => {
  const th = RANK_THRESHOLDS[difficulty] || RANK_THRESHOLDS.NORMAL;
  if (currentScore >= th.S) return "S";
  if (currentScore >= th.A) return "A";
  if (currentScore >= th.B) return "B";
  if (currentScore >= th.C) return "C";
  return "D";
};

export const useTypingGame = (difficulty: DifficultyLevel, wordData: WordDataMap | null) => {
  // ... (useState定義は変更なし) ...
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DIFFICULTY_SETTINGS[difficulty].time);
  
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState("0.00");

  const [gaugeValue, setGaugeValue] = useState(0);
  const [gaugeMax, setGaugeMax] = useState(150);
  
  const [isTimeAdded, setIsTimeAdded] = useState(false);
  const [isRainbowMode, setIsRainbowMode] = useState(false);
  
  const [bonusPopups, setBonusPopups] = useState<BonusPopup[]>([]);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [perfectPopups, setPerfectPopups] = useState<PerfectPopup[]>([]);

  const [shakeStatus, setShakeStatus] = useState<'none' | 'light' | 'error'>('none');

  const engineRef = useRef<TypingEngine | null>(null);
  const prevWordRef = useRef<string | null>(null);

  const [jpText, setJpText] = useState("");
  const [romaState, setRomaState] = useState<{ 
    typedLog: TypedLog[]; 
    current: string; 
    remaining: string;
  }>({ typedLog: [], current: "", remaining: "" });
  
  const [allSegments, setAllSegments] = useState<Segment[]>([]);
  
  const [correctCount, setCorrectCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [completedWords, setCompletedWords] = useState(0);
  const [currentWordMiss, setCurrentWordMiss] = useState(0);
  const [missedWordsRecord, setMissedWordsRecord] = useState<MissedWord[]>([]);
  const [missedCharsRecord, setMissedCharsRecord] = useState<Record<string, number>>({});
  const [backspaceCount, setBackspaceCount] = useState(0);
  
  const rank = calculateRank(difficulty, score);

  const getComboClass = (val: number) => {
    if (val >= 200) return "is-rainbow";
    if (val >= 100) return "is-gold";
    return "";
  };
  const comboClass = getComboClass(combo);

  const getScoreMultiplier = (currentCombo: number) => {
    if (currentCombo <= 50) return 1;
    if (currentCombo <= 100) return 2;
    if (currentCombo <= 200) return 4;
    return 10;
  };

  const addScorePopup = useCallback((amount: number) => {
      let type: ScorePopup['type'] = 'popup-normal';
      if (amount < 0) {
          type = 'popup-miss';
      } else if (amount >= 10000) {
          type = 'popup-rainbow';
      } else if (amount > 1000) {
          type = 'popup-gold';
      }
      const newP: ScorePopup = {
          id: Date.now() + Math.random(),
          text: amount > 0 ? `+${amount}` : `${amount}`,
          type
      };
      setScorePopups(prev => [...prev, newP]);
      setTimeout(() => setScorePopups(prev => prev.filter(p => p.id !== newP.id)), 1000);
  }, []);

  const addTime = useCallback((sec: number, isLarge: boolean = false) => {
      setTimeLeft(t => t + sec);
      setIsTimeAdded(true);
      setTimeout(() => setIsTimeAdded(false), 500);

      const newPopup: BonusPopup = {
          id: Date.now() + Math.random(),
          text: `+${sec}秒`,
          type: isLarge ? 'large' : 'normal'
      };
      setBonusPopups(prev => [...prev, newPopup]);
      setTimeout(() => setBonusPopups(prev => prev.filter(p => p.id !== newPopup.id)), 1000);
  }, []);

  const addPopup = useCallback((text: string, type: 'normal' | 'large' | 'miss') => {
      const newPopup: BonusPopup = {
          id: Date.now() + Math.random(),
          text: text,
          type: type
      };
      setBonusPopups(prev => [...prev, newPopup]);
      setTimeout(() => setBonusPopups(prev => prev.filter(p => p.id !== newPopup.id)), 1000);
  }, []);

  const triggerPerfect = useCallback(() => {
      const newP: PerfectPopup = { id: Date.now() };
      setPerfectPopups(prev => [...prev, newP]);
      setTimeout(() => setPerfectPopups(prev => prev.filter(p => p.id !== newP.id)), 1000);
  }, []);

  const updateDisplay = useCallback(() => {
    if (!engineRef.current) return;
    const engine = engineRef.current;
    
    const newTypedLog: TypedLog[] = [];
    engine.segments.forEach(seg => {
        seg.typedLog.forEach(log => newTypedLog.push(log));
    });

    const currentSegIndex = Math.min(engine.segIndex, engine.segments.length - 1);
    const currentSeg = engine.segments[currentSegIndex];
    const isActuallyFinished = engine.segIndex >= engine.segments.length;

    setRomaState({
      typedLog: newTypedLog, 
      current: (!isActuallyFinished && currentSeg) ? currentSeg.getCurrentChar() : "", 
      remaining: (!isActuallyFinished && currentSeg) ? currentSeg.getRemaining() : ""
    });
    setAllSegments([...engine.segments]); 
  }, []);

  const loadRandomWord = useCallback(() => {
    // ★変更: 引数で受け取った wordData を使う
    if (!wordData) return; // データがまだ無ければ何もしない

    const list = wordData[difficulty];
    if (!list || list.length === 0) return;

    let nextWord;
    if (list.length === 1) {
        nextWord = list[0];
    } else {
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
    setShakeStatus('none');
    
    if (engineRef.current.segments.length > 0) {
        const firstSeg = engineRef.current.segments[0];
        setRomaState({
            typedLog: [],
            current: firstSeg.getCurrentChar(),
            remaining: firstSeg.getRemaining()
        });
        setAllSegments([...engineRef.current.segments]);
    }
  }, [difficulty, wordData]); // ★依存配列に wordData を追加

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
    setCurrentSpeed("0.00");
    setIsTimeAdded(false);
    setIsRainbowMode(false);
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
    
    setScore(s => Math.max(0, s - 1000));
    addScorePopup(-1000);
    setBackspaceCount(c => c + 1);

    updateDisplay();
    setShakeStatus('none');
  }, [updateDisplay, addScorePopup]);

  useEffect(() => {
    if (elapsedTime > 0.1) { 
      const speed = correctCount / elapsedTime;
      setCurrentSpeed(speed.toFixed(2));
    } else {
      setCurrentSpeed("0.00");
    }
  }, [elapsedTime, correctCount]);

  const handleKeyInput = useCallback((key: string) => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    // ★修正: 単語入力完了済みでミスがある場合の処理
    const isFinished = engine.segIndex >= engine.segments.length;
    if (isFinished) {
       const allGreen = engine.segments.every(s => s.typedLog.every(t => t.color === "#4aff50"));
       if (!allGreen) {
           // 既に完了しているがミスがある状態でキーを打ったら減点する
           playMissSound();
           setShakeStatus('error');
           setTimeout(() => setShakeStatus('none'), 400);
           
           // 減点処理を追加
           setScore(s => Math.max(0, s - 300));
           addScorePopup(-300);
           setGaugeValue(g => Math.max(0, g - 20));
           // ミス数も増やす
           setMissCount(c => c + 1);
           // コンボもリセット
           setCombo(0);
           setIsRainbowMode(false);

           return;
       }
    }

    let targetChar = "";
    if (engine.segments[engine.segIndex]) {
        targetChar = engine.segments[engine.segIndex].getCurrentChar();
    }

    const result = engine.input(key);

    if (result.status === "MISS" || result.status === "MISS_ADVANCE" || result.status === "MISS_NEXT") {
      playMissSound();
      setMissCount(c => c + 1);
      setCurrentWordMiss(c => c + 1);
      setCombo(0);
      setIsRainbowMode(false);
      
      setShakeStatus('light');
      setTimeout(() => setShakeStatus('none'), 200);
      
      setGaugeValue(g => Math.max(0, g - 20)); 
      setScore(s => Math.max(0, s - 300));
      addScorePopup(-300);

      if (targetChar) {
          setMissedCharsRecord(prev => ({...prev, [targetChar]: (prev[targetChar] || 0) + 1}));
      }
    }

    if (result.status === "OK" || result.status === "NEXT" || result.status === "EXPANDED") {
      setShakeStatus('none');
      playTypeSound();
      setCorrectCount(c => c + 1);
      
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      if (nextCombo > maxCombo) setMaxCombo(nextCombo);
      
      let timeBonus = 0;
      let isLarge = false;
      if (nextCombo <= 100) {
          if (nextCombo > 0 && nextCombo % 20 === 0) timeBonus = 1;
      } else if (nextCombo <= 200) {
          if ((nextCombo - 100) % 25 === 0) { timeBonus = 3; isLarge = false; }
      } else {
          if ((nextCombo - 200) % 30 === 0) { timeBonus = 5; isLarge = true; }
      }

      if (timeBonus > 0) {
          playComboSound();
          addTime(timeBonus, isLarge);
      }

      if (nextCombo >= 200) setIsRainbowMode(true);

      const basePoint = 100;
      const multiplier = getScoreMultiplier(nextCombo);
      const addScore = basePoint * multiplier;
      
      setScore(s => s + addScore);
      addScorePopup(addScore);

      setGaugeValue(prev => prev + 1);
    }

    updateDisplay();

    const currentIsFinished = engine.segIndex >= engine.segments.length;
    if (currentIsFinished) {
       const allGreen = engine.segments.every(s => s.typedLog.every(t => t.color === "#4aff50"));
       
       if (allGreen) {
           playCorrectSound();
           setCompletedWords(c => c + 1);
           
           if (currentWordMiss === 0) {
               const wordLength = engine.segments.reduce((acc, s) => acc + s.display.length, 0);
               const bonus = wordLength * 500;
               setScore(s => s + bonus);
               addScorePopup(bonus);
               triggerPerfect();
           }

           if (currentWordMiss > 0) {
             setMissedWordsRecord(prev => [...prev, { word: jpText, misses: currentWordMiss }]);
           }
           loadRandomWord();
       } else {
           playMissSound();
           setShakeStatus('error');
           setTimeout(() => setShakeStatus('none'), 400);

           setScore(s => Math.max(0, s - 300));
           addScorePopup(-300);
           setGaugeValue(g => Math.max(0, g - 20));
           // ★ここでもコンボリセットを入れるとより厳格になります
           setCombo(0);
           setIsRainbowMode(false);
       }
    }

  }, [combo, maxCombo, jpText, currentWordMiss, loadRandomWord, updateDisplay, addTime, addScorePopup, triggerPerfect]);

  // ... (useEffect群は変更なし) ...
  useEffect(() => {
    if (gaugeValue >= gaugeMax) {
        playGaugeSound();
        addTime(10, true);
        setGaugeValue(0);
        setGaugeMax(prev => Math.min(300, prev + 50));
    }
  }, [gaugeValue, gaugeMax, addTime]);

  useEffect(() => {
    if (displayScore !== score) {
        const diff = score - displayScore;
        const step = Math.abs(diff) < 5 ? (diff > 0 ? 1 : -1) : Math.ceil(diff / 5);
        const timer = setTimeout(() => {
            setDisplayScore(prev => prev + step);
        }, 16);
        return () => clearTimeout(timer);
    }
  }, [score, displayScore]);

  return {
    score, displayScore, combo, comboClass, maxCombo, timeLeft, gaugeValue, gaugeMax,
    rank, correctCount, missCount, completedWords, backspaceCount,
    jpText, romaState, allSegments, shakeStatus, 
    missedWordsRecord, missedCharsRecord,
    isTimeAdded, isRainbowMode, bonusPopups, perfectPopups, scorePopups, 
    handleKeyInput, handleBackspace, startGame, resetGame,
    setTimeLeft, 
    setElapsedTime, currentSpeed, addPopup
  };
};