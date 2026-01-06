import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import './App.css';
import { type DifficultyLevel, DIFFICULTY_SETTINGS } from './utils/setting';
import { 
  initAudio, playDecisionSound, startSelectBgm, stopSelectBgm, 
  playGameBGM, stopGameBGM, playStartSound, playFinishSound,
  playResultSound, playRankSSound, playRankASound, playRankBSound, playRankCSound, playRankDSound
} from './utils/audio';
import { setVolumes } from './utils/audio';
import { useConfig } from './hooks/useConfig';
import { drawReadyAnimation, drawGoAnimation } from './utils/transitions';
import { useTypingGame, type WordDataMap } from './hooks/useTypingGame';

const preloadImages = () => {
  const images = [
    "/images/title.png", 
    "/images/level.png", 
    "/images/cloud.png", 
    "/images/Ready.jpg",
    "/images/icon_x.svg", 
    "/images/ranking.png", 
    "/images/X.jpg", 
    ...Object.values(DIFFICULTY_SETTINGS).map(s => s.bg)
  ];
  images.forEach(src => { const img = new Image(); img.src = src; });
};

// スコア数値のみ取得（後方互換）
const getSavedHighScore = (level: DifficultyLevel): number => {
    const key = `typing_hiscore_${level.toLowerCase()}`;
    const saved = localStorage.getItem(key);
    return saved ? parseInt(saved, 10) : 0;
};

// 詳細データも取得
const getSavedHighScoreData = (level: DifficultyLevel) => {
    const key = `typing_hiscore_data_${level.toLowerCase()}`;
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error("Save data parse error", e);
            return null;
        }
    }
    return null;
};

type GameState = 'loading' | 'title' | 'difficulty' | 'playing' | 'finishing' | 'result' | 'hiscore_review';
type PlayPhase = 'ready' | 'go' | 'game';

function App() {
  const { 
    isMuted, setIsMuted, 
    bgmVol, setBgmVol, 
    seVol, setSeVol, 
    showRomaji, setShowRomaji 
  } = useConfig();

  // 設定画面用のState
  const [tempPlayerName, setTempPlayerName] = useState('');
  const [nameError, setNameError] = useState('');

  const [gameState, setGameState] = useState<GameState>('loading');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('NORMAL');
  const [playPhase, setPlayPhase] = useState<PlayPhase>('ready');

  const [isLoaded, setIsLoaded] = useState(false);
  const [hoverDifficulty, setHoverDifficulty] = useState<DifficultyLevel | null>(null);
  const [isWhiteFade, setIsWhiteFade] = useState(false);

  // プレイヤー名（保存されたものを読み込む）
  const [playerName, setPlayerName] = useState(() => {
    const savedName = localStorage.getItem('typing_player_name');
    return savedName || 'Guest';
  });

  // 名前決定済みフラグ（保存されていれば true）
  const [isNameConfirmed, setIsNameConfirmed] = useState(() => {
    const savedName = localStorage.getItem('typing_player_name');
    return !!savedName; 
  })

  const [ngWordsList, setNgWordsList] = useState<string[]>([]);

  const [titlePhase, setTitlePhase] = useState<'normal' | 'input' | 'confirm'>('normal');

  const [userId] = useState(() => {
    let id = localStorage.getItem('typing_user_id');
    if (!id) {
      id = crypto.randomUUID(); 
      localStorage.setItem('typing_user_id', id);
    }
    return id;
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInputLocked, setIsInputLocked] = useState(true); 

  const [showTitle, setShowTitle] = useState(false);
  const [enableBounce, setEnableBounce] = useState(false);
  const [isTitleExiting, setIsTitleExiting] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // --- ランキング機能 ---
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const [isDevRankingMode, setIsDevRankingMode] = useState(false);

  // 単語データ
  const [dbWordData, setDbWordData] = useState<WordDataMap | null>(null);

  // リザルト・スコア関連
  const [highScore, setHighScore] = useState(0); 
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [scoreDiff, setScoreDiff] = useState(0);
   
  // 閲覧モード用の詳細データ保持
  const [reviewData, setReviewData] = useState<any>(null);

  // 直前のゲーム結果を固定保持するためのステート
  const [lastGameStats, setLastGameStats] = useState<any>(null);

  const [resultAnimStep, setResultAnimStep] = useState(0);
  const resultTimersRef = useRef<number[]>([]);
  const hasSaved = useRef(false);

  const [isFinishExit, setIsFinishExit] = useState(false);

  // useTypingGame
  const { 
    score, displayScore, combo, comboClass, timeLeft, jpText, romaState, 
    handleKeyInput, handleBackspace, startGame, resetGame,
    gaugeValue, gaugeMax, 
    rank, correctCount, missCount, maxCombo, completedWords, backspaceCount,
    allSegments, shakeStatus, 
    missedWordsRecord, missedCharsRecord, isTimeAdded, isRainbowMode, bonusPopups, perfectPopups, scorePopups,
    setElapsedTime, currentSpeed,
    setTimeLeft 
  } = useTypingGame(difficulty, dbWordData);

  // 現在入力中の単語のミス数を追跡
  const currentWordMissRef = useRef(0);
  const prevMissCountRef = useRef(0);
  const prevWordRef = useRef("");

  useEffect(() => {
    if (jpText !== prevWordRef.current) {
      currentWordMissRef.current = 0;
      prevWordRef.current = jpText;
    }
    
    if (missCount > prevMissCountRef.current) {
      currentWordMissRef.current += (missCount - prevMissCountRef.current);
    }
    
    prevMissCountRef.current = missCount;
  }, [missCount, jpText]);

  // アプリ起動時に Supabase から単語リストとNGワードを取得
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // ------------------------------------------
        // 1. ゲーム用単語データの取得 (wordsテーブル)
        // ------------------------------------------
        const { data: wordsData, error: wordsError } = await supabase
          .from('words')
          .select('jp, roma, difficulty');

        if (wordsError) throw wordsError;

        if (wordsData) {
          const formattedData: WordDataMap = {
            EASY: [],
            NORMAL: [],
            HARD: []
          };

          wordsData.forEach((row: any) => {
            if (formattedData[row.difficulty]) {
              formattedData[row.difficulty].push({
                jp: row.jp,
                roma: row.roma
              });
            }
          });

          setDbWordData(formattedData);
          console.log("単語データロード完了");
        }

        // ------------------------------------------
        // 2. NGワードの取得 (ng_wordsテーブル)
        // ------------------------------------------
        const { data: ngData, error: ngError } = await supabase
          .from('ng_words')
          .select('word'); // 'word'カラムだけ取得

        if (ngError) throw ngError;

        if (ngData) {
          // DBの形 [{word: "xx"}, {word: "yy"}] を ["xx", "yy"] に変換
          const list = ngData.map((item: any) => item.word);
          
          setNgWordsList(list); // Stateに保存
          console.log("NGワードロード完了:", list);
        }

      } catch (err) {
        console.error("データ取得に失敗:", err);
      }
    };

    fetchAllData();
  }, []);

  // ----------------------------------------------------
  // ★設定画面用の変数と関数
  // ----------------------------------------------------
   
  const [showConfig, setShowConfig] = useState(false);

  const handleOpenConfig = () => {
    playDecisionSound();
    setTempPlayerName(playerName);
    setNameError(''); // エラーリセット
    setShowConfig(true);
  };

  const handleCloseConfig = () => {
    playDecisionSound();
    setShowConfig(false);
  };

  const handleConfigNameSubmit = async () => {
    const trimmedName = tempPlayerName.trim();
    const MAX_LENGTH = 10;
    
    setNameError(''); // エラーリセット

    if (!trimmedName) {
      setNameError("名前を入力してください");
      return;
    }
    if (trimmedName.length > MAX_LENGTH) {
      setNameError(`名前は${MAX_LENGTH}文字以内で入力してください`);
      return;
    }

    const isNg = ngWordsList.some(word => 
      trimmedName.toLowerCase().includes(word.toLowerCase())
    );

    if (isNg) {
      setNameError("不適切な文字が含まれています");
      return; 
    }

    // ローカル保存
    setPlayerName(trimmedName);
    localStorage.setItem('typing_player_name', trimmedName);

    // DB更新
    try {
      const { error } = await supabase
        .from('scores')
        .update({ name: trimmedName })
        .eq('user_id', userId);

      if (error) throw error;
      console.log("過去のスコア名義も更新しました");
    } catch (err) {
      console.error("名前更新エラー:", err);
    }

    playDecisionSound();
  };

  const handleKeyInputRef = useRef(handleKeyInput);
  const handleBackspaceRef = useRef(handleBackspace);
   
  useEffect(() => {
    handleKeyInputRef.current = handleKeyInput;
    handleBackspaceRef.current = handleBackspace;
  }, [handleKeyInput, handleBackspace]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const readyImageRef = useRef<HTMLImageElement | null>(null);

  const animState = useRef({
    readyY: -800,
    isReadyAnimating: false,
    showEnterText: false,
    showGoText: false,
    goScale: 0,
    phase: 'idle'
  });

  useEffect(() => {
    preloadImages();
    initAudio();
    const img = new Image();
    img.src = "/images/Ready.jpg";
    img.onload = () => { readyImageRef.current = img; };

    const checkLoad = setInterval(() => {
        if (dbWordData) {
            clearInterval(checkLoad);
            setIsLoaded(true);
            setGameState('title');
            
            setTimeout(() => { 
                setShowTitle(true); 
                setTimeout(() => {
                    setEnableBounce(true);
                    setIsInputLocked(false);
                }, 1200);
            }, 500); 
        }
    }, 100);

    return () => clearInterval(checkLoad);
  }, [dbWordData]);

  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const handleOpenHowToPlay = () => {
    playDecisionSound();
    setShowHowToPlay(true);
  };

  const handleCloseHowToPlay = () => {
    playDecisionSound();
    setShowHowToPlay(false);
  };

  useEffect(() => {
    setVolumes(bgmVol, seVol);
    localStorage.setItem('typing_bgm_vol', bgmVol.toString());
    localStorage.setItem('typing_se_vol', seVol.toString());
  }, [bgmVol, seVol]);

  // ★ タイトル画面で入力フォームを開く処理
  const handleStartSequence = () => {
    if (isTitleExiting || isInputLocked) return;

    if (isNameConfirmed) {
      goToDifficulty();
      return;
    }

    playDecisionSound();
    setIsInputLocked(true); 
    setIsTitleExiting(true); 

    setTimeout(() => {
      setIsTitleExiting(false);
      setIsInputLocked(false);
      setNameError(''); // ★エラーリセット
      setTitlePhase('input'); 
    }, 700);
  };

  // ★ タイトル画面：入力キャンセル（タイトルロゴへ戻る）
  const handleCancelInput = () => {
    playDecisionSound();
    setTitlePhase('normal');
  };

  // ★ タイトル画面：名前決定処理
  const handleNameSubmit = () => {
    const trimmedName = playerName.trim();
    const MAX_LENGTH = 10;
    
    setNameError(''); // エラーリセット

    if (!trimmedName) {
      setPlayerName('Guest'); 
    }

    if (trimmedName && trimmedName.length > MAX_LENGTH) {
      setNameError(`名前は${MAX_LENGTH}文字以内で入力してください`);
      return;
    }

    const isNg = ngWordsList.some(word => 
      trimmedName.toLowerCase().includes(word.toLowerCase())
    );
    
    if (isNg) {
      setNameError("不適切な文字が含まれています");
      return; 
    }

    setPlayerName(trimmedName || 'Guest');
    playDecisionSound();
    setTitlePhase('confirm');
  };

  const handleFinalConfirm = () => {
    localStorage.setItem('typing_player_name', playerName);
    playDecisionSound();
    startSelectBgm();
    setIsNameConfirmed(true);
    setGameState('difficulty');
    setTitlePhase('normal');
  };

  const handleBackToInput = () => {
    playDecisionSound();
    setTitlePhase('input');
  };

  useEffect(() => {
    const handleResize = () => {
      const scaler = document.getElementById("scaler");
      if (scaler) {
        const scale = Math.min(window.innerWidth / 1200, window.innerHeight / 780);
        scaler.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let interval: number;
    if (gameState === 'playing' && playPhase === 'game' && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 0.1));
        setElapsedTime(prev => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [gameState, playPhase, timeLeft, setTimeLeft, setElapsedTime]);

  useEffect(() => {
    if (gameState === 'playing' && playPhase === 'game' && timeLeft <= 0) {
        stopGameBGM();
        playFinishSound();

        let finalWeakWords = [...missedWordsRecord];
        if (currentWordMissRef.current > 0) {
            const existing = finalWeakWords.find(w => w.word === jpText);
            if (existing) {
                existing.misses += currentWordMissRef.current;
            } else {
                finalWeakWords.push({ 
                    word: jpText, 
                    misses: currentWordMissRef.current 
                });
            }
        }

        const sortedWeakWordsRecord = finalWeakWords
            .sort((a, b) => b.misses - a.misses)
            .slice(0, 5);

        setLastGameStats({
          score,
          words: completedWords,
          correct: correctCount,
          miss: missCount,
          backspace: backspaceCount,
          combo: maxCombo,
          speed: currentSpeed,
          rank: rank,
          weakWords: sortedWeakWordsRecord,
          weakKeys: missedCharsRecord
        });

        setGameState('finishing');
        
        setIsFinishExit(false); 
        setIsWhiteFade(false);

        const currentSaved = getSavedHighScore(difficulty);
        if (score > currentSaved) {
            setIsNewRecord(true);
        } else {
            setIsNewRecord(false);
        }

        setTimeout(() => setIsFinishExit(true), 1500);
        setTimeout(() => setIsWhiteFade(true), 2000);
        setTimeout(() => {
            setGameState('result');
            setIsWhiteFade(false);
            setIsFinishExit(false);
        }, 2500);
    }
  }, [
      timeLeft, gameState, playPhase, score, highScore, difficulty, 
      correctCount, missCount, backspaceCount, maxCombo, currentSpeed, rank, 
      missedWordsRecord, missedCharsRecord, jpText
  ]);

  const saveScore = useCallback(async () => {
    if (saveStatus === 'saving' || saveStatus === 'success') return;
    
    const targetStats = lastGameStats || {
      score, words: completedWords, correct: correctCount, miss: missCount, backspace: backspaceCount, combo: maxCombo, speed: currentSpeed
    };

    if (targetStats.score <= 0) {
        setSaveStatus('success'); 
        return;
    }

    setSaveStatus('saving');

    try {
      const { data: existingData, error: fetchError } = await supabase
        .from('scores')
        .select('*')
        .eq('user_id', userId)
        .eq('difficulty', difficulty)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
         throw fetchError;
      }

      if (existingData) {
        if (targetStats.score > existingData.score) {
          console.log("ハイスコア更新！");
          const { error: updateError } = await supabase
            .from('scores')
            .update({
               name: playerName, 
               score: targetStats.score,
               correct: targetStats.correct,
               miss: targetStats.miss,
               backspace: targetStats.backspace,
               combo: targetStats.combo,
               speed: targetStats.speed,
               created_at: new Date().toISOString()
            })
            .eq('id', existingData.id);

          if (updateError) throw updateError;
        }
      } 
      else {
        console.log("新規データ作成");
        const { error: insertError } = await supabase
          .from('scores')
          .insert([{
            user_id: userId,
            name: playerName,
            difficulty: difficulty,
            score: targetStats.score,
            correct: targetStats.correct,
            miss: targetStats.miss,
            backspace: targetStats.backspace,
            combo: targetStats.combo,
            speed: targetStats.speed,
          }]);
          
        if (insertError) throw insertError;
      }

      setSaveStatus('success');

    } catch (error: any) {
      console.error('❌ 保存エラー:', error.message);
      setSaveStatus('error');
    }
  }, [difficulty, lastGameStats, score, correctCount, missCount, backspaceCount, maxCombo, currentSpeed, saveStatus, playerName, userId]);

  const fetchRanking = async (targetDiff?: DifficultyLevel) => {
    playDecisionSound();
    const searchDiff = targetDiff || difficulty; 
    
    if (targetDiff) {
      setDifficulty(targetDiff);
    }

    setIsDevRankingMode(false);
    setRankingData([]); 

    console.log("ランキング取得開始:", searchDiff);
    
    const { data, error } = await supabase
      .from('scores')
      .select('*, user_data:users!scores_user_id_fkey!inner(role)')
      .eq('difficulty', searchDiff) 
      .eq('user_data.role', 'user')
      .order('score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('ランキング取得エラー:', error);
    } else {
      setRankingData(data || []);
      setShowRanking(true);
    }
  };

  const handleShowDevScore = async () => {
    playDecisionSound();
    if (isDevRankingMode) return; 

    try {
      const { data, error } = await supabase
        .from('scores')
        .select('*, user_data:users!scores_user_id_fkey!inner(role)')
        .eq('difficulty', difficulty)
        .eq('user_data.role', 'admin')
        .order('score', { ascending: false })
        .limit(1);

      if (error) throw error;

      setRankingData(data || []);
      setIsDevRankingMode(true); 

    } catch (err) {
      console.error("Dev score fetch error:", err);
    }
  };

  const closeRanking = () => {
    setShowRanking(false);
    playDecisionSound();
  };

  useEffect(() => {
    if (gameState === 'result') {
        if (!hasSaved.current) {
          saveScore();
          hasSaved.current = true;
        }
        
        const storageKey = `typing_hiscore_${difficulty.toLowerCase()}`;
        const dataKey = `typing_hiscore_data_${difficulty.toLowerCase()}`;
        
        const currentStats = lastGameStats || {
            score, words: completedWords, correct: correctCount, miss: missCount, backspace: backspaceCount, 
            combo: maxCombo, speed: currentSpeed, rank, weakWords: missedWordsRecord, weakKeys: missedCharsRecord
        };

        const savedScore = parseInt(localStorage.getItem(storageKey) || "0", 10);

        let diff = 0;
        if (currentStats.score > savedScore) {
            setIsNewRecord(true);
            setHighScore(currentStats.score); 
            
            localStorage.setItem(storageKey, currentStats.score.toString());
            
            const highScoreData = {
                score: currentStats.score,
                words: currentStats.words,
                correct: currentStats.correct,
                miss: currentStats.miss,
                backspace: currentStats.backspace,
                maxCombo: currentStats.combo,
                speed: currentStats.speed,
                weakWords: currentStats.weakWords,
                weakKeys: currentStats.weakKeys,
                rank: currentStats.rank
            };
            localStorage.setItem(dataKey, JSON.stringify(highScoreData));

            diff = currentStats.score - savedScore;
        } else {
            setIsNewRecord(false);
            setHighScore(savedScore); 
            diff = currentStats.score - savedScore;
        }
        setScoreDiff(diff);

        setResultAnimStep(0);
        resultTimersRef.current = [];

        const schedule = [
            { step: 1, delay: 600, sound: playResultSound },
            { step: 2, delay: 1300, sound: playResultSound },
            { step: 3, delay: 2000, sound: playResultSound },
            { step: 4, delay: 3500, sound: () => {
                if (currentStats.rank === 'S') playRankSSound();
                else if (currentStats.rank === 'A') playRankASound();
                else if (currentStats.rank === 'B') playRankBSound();
                else if (currentStats.rank === 'C') playRankCSound();
                else playRankDSound();
            }}, 
            { step: 5, delay: 4500, sound: null }
        ];

        schedule.forEach(({ step, delay, sound }) => {
            const timer = window.setTimeout(() => {
                setResultAnimStep(step);
                if (sound) sound();
            }, delay);
            resultTimersRef.current.push(timer);
        });

        return () => {
            resultTimersRef.current.forEach(clearTimeout);
        };
    }
  }, [gameState, score, difficulty, rank, correctCount, missCount, backspaceCount, maxCombo, currentSpeed, missedWordsRecord, missedCharsRecord, lastGameStats]);

  useEffect(() => {
    const savedScore = getSavedHighScore(difficulty);
    setHighScore(savedScore);
  }, [difficulty]);

  const handleResultClick = () => {
      if (gameState === 'result' && resultAnimStep < 5) {
          resultTimersRef.current.forEach(clearTimeout);
          resultTimersRef.current = [];
          
          setResultAnimStep(5);
          
          const targetRank = lastGameStats ? lastGameStats.rank : rank;

          if (targetRank === 'S') playRankSSound();
          else if (targetRank === 'A') playRankASound();
          else if (targetRank === 'B') playRankBSound();
          else if (targetRank === 'C') playRankCSound();
          else playRankDSound();
      }
  };

  const getCurrentBgSrc = () => {
    if (gameState === 'title') return "/images/title.png";
    if (gameState === 'difficulty') {
      if (isTransitioning) return DIFFICULTY_SETTINGS[difficulty].bg;
      return hoverDifficulty ? DIFFICULTY_SETTINGS[hoverDifficulty].bg : "/images/level.png";
    }
    if (gameState === 'playing' || gameState === 'finishing' || gameState === 'result') {
      return DIFFICULTY_SETTINGS[difficulty].bg;
    }
    return "/images/title.png";
  };

  const animate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const state = animState.current;

    if (canvas && ctx && (gameState === 'playing' || gameState === 'finishing')) {
      canvas.width = 1200;
      canvas.height = 780;

      if (playPhase === 'ready') {
        if (state.isReadyAnimating) {
          state.readyY += 30;
          if (state.readyY >= 0) {
            state.readyY = 0;
            state.isReadyAnimating = false;
            state.showEnterText = true;
          }
        }
        drawReadyAnimation(ctx, canvas.width, canvas.height, state.readyY, readyImageRef.current, state.showEnterText);
      }
      else if (playPhase === 'go') {
        if (hasSaved.current !== false) {
           hasSaved.current = false;
        }

        if (state.goScale < 1.0) state.goScale += 0.1;
        drawGoAnimation(ctx, canvas.width, canvas.height, state.goScale);
      }
      else if (playPhase === 'game') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, playPhase]);

  const resetToReady = () => {
    playDecisionSound();
    stopGameBGM(); 
    resetGame(); 
    hasSaved.current = false;
    setSaveStatus('idle');
    setPlayPhase('ready'); 
    animState.current = {
      readyY: -800,
      isReadyAnimating: true,
      showEnterText: false,
      showGoText: false,
      goScale: 0,
      phase: 'ready'
    };
  };

  const backToDifficulty = () => {
    playDecisionSound();
    
    if (gameState !== 'hiscore_review') {
        stopGameBGM();
        startSelectBgm();
    }
    
    setGameState('difficulty');
    setIsTransitioning(false);
  };

  const retryGame = () => {
      if (isTransitioning) return;
      setSaveStatus('idle');
      setIsTransitioning(true);
      playDecisionSound();
      resetGame();
      setIsFinishExit(false);
      setIsWhiteFade(false);
      setTimeLeft(DIFFICULTY_SETTINGS[difficulty].time);
      stopSelectBgm();
      animState.current = { readyY: -800, isReadyAnimating: true, showEnterText: false, showGoText: false, goScale: 0, phase: 'ready' };
      setTimeout(() => {
          setPlayPhase('ready');
          setGameState('playing');
          setIsTransitioning(false);
          setIsInputLocked(false);
          hasSaved.current = false;
      }, 50);
  };

  const handleResultKeyAction = (key: string) => {
      if (key === 'Enter') {
        if (resultAnimStep < 5) handleResultClick(); else retryGame();
      } else if (key === 'Escape') {
        if (resultAnimStep < 5) handleResultClick(); else backToDifficulty();
      }
  };

  const goToDifficulty = () => {
    if (isTitleExiting || isInputLocked) return;
    
    playDecisionSound();
    setIsInputLocked(true);
    setIsTitleExiting(true);

    setTimeout(() => {
        startSelectBgm();
        setGameState('difficulty');
        setIsTitleExiting(false);
        setTimeout(() => setIsInputLocked(false), 500);
    }, 600);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
         if (["Shift", "Alt", "Meta", "Control", "Tab", "CapsLock", "Insert", "Delete", "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) || e.key.startsWith("F") && e.key.length > 1) return;
      }
      if (e.isComposing || ["Process", "KanaMode", "Conversion", "NonConvert"].includes(e.code)) return;

      const state = animState.current;

      if (gameState === 'playing' && playPhase === 'ready' && !state.isReadyAnimating) {
        if (e.key === 'Enter') {
          playStartSound();
          setPlayPhase('go');
          state.goScale = 0;
          setTimeout(() => {
            setPlayPhase('game');
            startGame();
            playGameBGM(DIFFICULTY_SETTINGS[difficulty].bgm);
          }, 1000);
        } else if (e.key === 'Escape') {
           backToDifficulty();
        }
      }
      else if (gameState === 'playing' && playPhase === 'game') {
        if (e.key === 'Escape') {
            e.preventDefault();
            resetToReady();
            return;
        }
        if (e.key === 'Backspace') {
            e.preventDefault();
            handleBackspaceRef.current(); 
            return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            handleKeyInputRef.current(e.key.toLowerCase());
        }
      }
      else if (gameState === 'result') {
          handleResultKeyAction(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [gameState, playPhase, startGame, difficulty, resultAnimStep, handleStartSequence]);

  const handleSelectDifficulty = (diff: DifficultyLevel) => {
    if (isTransitioning || isInputLocked) return;
    
    setIsTransitioning(true);
    setIsInputLocked(true);

    playDecisionSound();
    setDifficulty(diff);
    resetGame();
    setSaveStatus('idle');
    setIsFinishExit(false);
    setIsWhiteFade(false);
    
    setTimeLeft(DIFFICULTY_SETTINGS[diff].time);
    stopSelectBgm();
    animState.current = {
      readyY: -800,
      isReadyAnimating: true,
      showEnterText: false,
      showGoText: false,
      goScale: 0,
      phase: 'ready'
    };
    
    setTimeout(() => {
        setPlayPhase('ready');
        setGameState('playing');
        setIsTransitioning(false);
        setIsInputLocked(false);
        hasSaved.current = false;
    }, 50);
  };

  const backToTitle = () => {
    playDecisionSound();
    stopSelectBgm();
    stopGameBGM();
    hasSaved.current = false;
    setSaveStatus('idle');
    
    setGameState('title');
    setShowTitle(false); 
    setEnableBounce(false);
    setIsTitleExiting(false);
    
    setIsInputLocked(true); 
    setTimeout(() => {
        setShowTitle(true);
        setTimeout(() => {
            setEnableBounce(true);
            setIsInputLocked(false);
        }, 1200);
    }, 100);
  };

  const getShareUrl = () => {
      const text = encodeURIComponent(`CRITICAL TYPINGでスコア:${score.toLocaleString()} ランク:${rank} を獲得しました！`);
      const hashtags = encodeURIComponent("CriticalTyping,タイピング");
      const url = encodeURIComponent("https://example.com"); 
      return `https://twitter.com/intent/tweet?text=${text}&hashtags=${hashtags}&url=${url}`;
  };

  const handleMouseEnter = (diff: DifficultyLevel) => {
      if (!isTransitioning && !isInputLocked) {
          setHoverDifficulty(diff);
          setDifficulty(diff);
      }
  };

  const handleMenuLeave = () => {
      if (!isTransitioning && !isInputLocked) {
          setHoverDifficulty(null);
      }
  };

  const handleShowHighScoreDetail = () => {
    const displayDiff = hoverDifficulty || difficulty;
    const data = getSavedHighScoreData(displayDiff);
    
    if (data) {
        setReviewData(data); 
    } else {
        const savedScore = getSavedHighScore(displayDiff);
        setReviewData({
            score: savedScore,
            correct: 0, words: 0, miss: 0, backspace: 0, speed: 0, maxCombo: 0,
            rank: '-', weakWords: [], weakKeys: {}
        });
    }

    setResultAnimStep(5);
    setGameState('hiscore_review'); 
  };

  const displayDiff = hoverDifficulty || difficulty;
  const displayHighScore = getSavedHighScore(displayDiff);

  const allBackgrounds = [
      { key: 'title', src: "/images/title.png" },
      { key: 'level', src: "/images/level.png" },
      ...(['EASY', 'NORMAL', 'HARD'] as DifficultyLevel[]).map(d => ({
          key: d,
          src: DIFFICULTY_SETTINGS[d].bg
      }))
  ];
  const targetBgSrc = getCurrentBgSrc();

  const sortedWeakWords = [...missedWordsRecord].sort((a,b) => b.misses - a.misses).slice(0, 5);
  const sortedWeakKeys = Object.entries(missedCharsRecord).sort((a,b) => b[1] - a[1]).slice(0, 5);

  const hasPunctuation = jpText.endsWith('。') || jpText.endsWith('、');

  let targetResultData: any;
  if (gameState === 'hiscore_review' && reviewData) {
      targetResultData = {
          score: reviewData.score,
          words: reviewData.words || 0,
          correct: reviewData.correct,
          miss: reviewData.miss, 
          backspace: reviewData.backspace,
          speed: reviewData.speed,
          maxCombo: reviewData.maxCombo,
          rank: reviewData.rank,
          weakWords: reviewData.weakWords || [],
          weakKeys: reviewData.weakKeys || {}
      };
  } else if (gameState === 'result' && lastGameStats) {
      targetResultData = {
          score: lastGameStats.score,
          words: lastGameStats.words,
          correct: lastGameStats.correct,
          miss: lastGameStats.miss,
          backspace: lastGameStats.backspace,
          speed: lastGameStats.speed,
          maxCombo: lastGameStats.combo,
          rank: lastGameStats.rank,
          weakWords: lastGameStats.weakWords,
          weakKeys: lastGameStats.weakKeys
      };
  } else {
      targetResultData = {
          score: score,
          words: completedWords,
          correct: correctCount,
          miss: missCount,
          backspace: backspaceCount,
          speed: currentSpeed,
          maxCombo: maxCombo,
          rank: rank,
          weakWords: sortedWeakWords,
          weakKeys: missedCharsRecord
      };
  }

  const displayWeakWords = gameState === 'hiscore_review' ? targetResultData.weakWords : (gameState === 'result' && lastGameStats ? lastGameStats.weakWords : sortedWeakWords);
  const displayWeakKeys = (gameState === 'hiscore_review' || (gameState === 'result' && lastGameStats))
      ? Object.entries(targetResultData.weakKeys).sort((a:any,b:any) => b[1] - a[1]).slice(0, 5) 
      : sortedWeakKeys;

  return (
    <div className="App">
      <div id="scaler">
        <div id="game-wrapper">
          {allBackgrounds.map(bg => (
              <div 
                  key={bg.key}
                  className="bg-layer"
                  style={{
                      backgroundImage: `url(${bg.src})`,
                      opacity: targetBgSrc === bg.src ? 1 : 0,
                      zIndex: targetBgSrc === bg.src ? 1 : 0
                  }}
              />
          ))}
          
          <div id="game-screen" className={`${isRainbowMode ? "rainbow-glow" : ""} ${gameState === 'finishing' ? "bg-blur" : ""}`} style={{position:'absolute', width:'100%', height:'100%', pointerEvents:'none', zIndex:2}}></div>
          <div id="fade-overlay" style={{opacity: isWhiteFade ? 1 : 0}}></div>

          {(!isLoaded || gameState === 'loading') && (
            <div id="loading-screen" className={isLoaded ? 'fade-out' : ''}>
              <div className="keyboard-loader">
                {['L','O','A','D','I','N','G'].map((char, i) => (<div key={i} className="key cat">{char}</div>))}
              </div>
              <div className="loading-text">
                <span className="paw">🐾</span> Loading... <span className="paw">🐾</span>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} id="myCanvas" className={gameState === 'playing' ? '' : 'hidden'} style={{zIndex: 15, position:'relative', pointerEvents:'none'}} />

          {/* TITLE SCREEN */}
          {gameState === 'title' && (
            <div className="title-screen">

              <div 
                 className={`title-content-wrapper ${titlePhase !== 'normal' ? 'exit' : 'enter'}`}
                 style={{display: 'flex', flexDirection:'column', alignItems:'center', width:'100%'}}
              >
                  <div className={`title-anim-wrapper ${showTitle ? 'visible' : ''} ${(titlePhase !== 'normal' || isTitleExiting) ? 'exit-up' : ''}`}>
                      <h1 className={`game-title ${enableBounce ? 'bouncing' : ''}`}>CRITICAL TYPING</h1>
                  </div>

                  <div className={`main-menu-buttons fade-element ${showTitle ? 'visible' : ''} ${(titlePhase !== 'normal' || isTitleExiting) ? 'exit-down' : ''}`}>
                    <button className="menu-btn" onClick={(e) => { e.stopPropagation(); handleStartSequence(); }}>ゲームスタート</button>
                    <button className="menu-btn" onClick={(e) => { e.stopPropagation(); handleOpenHowToPlay(); }}>遊び方</button>
                    <button className="menu-btn" onClick={handleOpenConfig}>設定</button>
                  </div>
              </div>

              {/* ▼▼▼ タイトル画面：名前入力（UI修正済） ▼▼▼ */}
              {titlePhase === 'input' && (
                <div className="pop-modal-frame fade-in-pop" onClick={e => e.stopPropagation()}>
                  
                  {/* 中央揃えのラベル */}
                  <label className="pop-label" style={{textAlign:'center', width:'100%', margin:0}}>名前を入力して下さい</label>
                  
                  {/* 入力フォーム */}
                  <input
                    type="text"
                    className={`pop-input ${nameError ? 'input-error-shake' : ''}`}
                    value={playerName}
                    onChange={(e) => {
                        setPlayerName(e.target.value);
                        if (nameError) setNameError(''); 
                    }}
                    maxLength={10}
                    placeholder="Guest"
                    autoFocus
                    style={{
                        marginTop: '15px',
                        transition: 'all 0.3s'
                    }}
                  />

                  {/* 下段：エラーメッセージのみ表示（エラーがない時は注釈） */}
                  <div style={{height:'20px', marginTop:'5px', width:'100%', textAlign:'center'}}>
                    {nameError ? (
                        <p className="error-fade-in" style={{fontSize:'0.85rem', color:'#ff4444', margin:0, fontWeight:'bold'}}>
                          {nameError}
                        </p>
                    ) : (
                        <p className="pop-note" style={{margin:0}}>※名前はあとからでも変更出来ます</p>
                    )}
                  </div>

                  {/* ボタン（キャンセル追加！） */}
                  <div style={{marginTop:'15px', display:'flex', gap:'15px', justifyContent:'center'}}>
                    <button className="pop-btn" onClick={handleCancelInput}>キャンセル</button>
                    <button className="pop-btn primary" onClick={handleNameSubmit}>OK</button>
                  </div>
                </div>
              )}

              {titlePhase === 'confirm' && (
                <div className="pop-modal-frame fade-in-pop" onClick={e => e.stopPropagation()}>
                  <label className="pop-label">以下の名前で始めます。<br/>よろしいですか？</label>
                  <div className="confirm-name-disp">{playerName}</div>
                  <div style={{marginTop:'25px', display:'flex', justifyContent:'center'}}>
                    <button className="pop-btn" onClick={handleBackToInput}>戻る</button>
                    <button className="pop-btn primary" onClick={handleFinalConfirm}>はい</button>
                  </div>
                  <p className="pop-note">※名前は後からでも変更できます。</p>
                </div>
              )}
            </div>
          )}
          

          {/* DIFFICULTY */}
          {gameState === 'difficulty' && (
            <div id="difficulty-view" style={{position:'relative', zIndex: 5}}>
              <h1 className="diff-view-title">SET DIFFICULTY</h1>
              <div className="diff-main-container">
                <div className={`diff-button-menu ${isInputLocked ? 'no-click' : ''}`} onMouseLeave={handleMenuLeave}>
                  {(['EASY', 'NORMAL', 'HARD'] as DifficultyLevel[]).map(diff => (
                    <button key={diff} className={`diff-btn ${diff.toLowerCase()}`} onMouseEnter={() => handleMouseEnter(diff)} onClick={() => handleSelectDifficulty(diff)}>
                        {diff}
                    </button>
                  ))}
                  <button id="btn-back" className="diff-btn" onClick={backToTitle}>BACK</button>
                </div>
                <div className={`diff-info-panel visible`}>
                    <>
                      <div className="diff-header-group">
                          <img src="/images/ranking.png" alt="Ranking" className="crown-icon-only" onClick={() => fetchRanking(displayDiff)}/>
                          <div className="diff-hiscore-box">
                            <div className="hiscore-label-group">
                              <button 
                                className="hiscore-detail-btn"
                                onClick={handleShowHighScoreDetail}
                                title="詳細リザルトを見る"
                              >
                                📄
                              </button>
                              <span className="label">HI-SCORE</span>
                            </div>
                            <span id="menu-hiscore-val">{displayHighScore.toLocaleString()}</span>
                          </div>
                        </div>
                      <h2 id="display-diff-name" style={{color: DIFFICULTY_SETTINGS[displayDiff].color}}>{displayDiff}</h2>
                      <p id="display-diff-text">{DIFFICULTY_SETTINGS[displayDiff].text}</p>
                      <div className="diff-info-footer">
                          <div className="status-item" id="display-diff-time">{DIFFICULTY_SETTINGS[displayDiff].time}s</div>
                          <div className="status-item" id="display-diff-chars">{DIFFICULTY_SETTINGS[displayDiff].chars}</div>
                      </div>
                    </>
                </div>
              </div>
            </div>
          )}

          {/* GAME HUD */}
          {(gameState === 'playing' || gameState === 'finishing') && playPhase !== 'ready' && (
            <div id="game-hud" style={{zIndex: 10}}>
            {playPhase === 'game' && gameState !== 'finishing' && (
              <div 
                className="blink-guide"
                style={{
                  position: 'absolute',
                  top: '740px',
                  width: '100%',
                  textAlign: 'center',
                  zIndex: 100
                }}
              >
                — Escキーで最初からやり直す —
              </div>
            )}
              <div id="finish-banner" className={`${gameState === 'finishing' ? "show" : ""} ${isFinishExit ? "exit" : ""}`}>FINISH!</div>
              <div id="score-container">
                  SCORE: <span id="score">{displayScore}</span>
                  <div id="score-popups">{scorePopups.map(p => (<div key={p.id} className={`score-popup ${p.type}`}>{p.text}</div>))}</div>
              </div>
              <div id="perfect-container">{perfectPopups.map(p => (<div key={p.id} className="perfect-item">PERFECT!!</div>))}</div>
              <div id="center-area" style={{ opacity: (playPhase === 'game' && gameState !== 'finishing') ? 1 : 0, transition: 'opacity 0.2s' }}>
                  <div id="text-word-wrapper">
                  <div 
                      id="text-word" 
                      className={shakeStatus === 'light' ? "light-shake" : shakeStatus === 'error' ? "error-shake" : ""}
                      style={{ 
                          padding: showRomaji ? '20px 65px' : '20px 30px',
                          transition: 'padding 0.3s ease'
                      }}
                  >
                      <div id="romaji-line">
                        {romaState.typedLog.map((log, i) => (<span key={i} style={{color: log.color}}>{log.char}</span>))}
                          <span className="text-yellow" style={{textDecoration:'underline'}}>{romaState.current}</span>
                          <span style={{color:'white'}}>{romaState.remaining}</span>
                      </div>

                      <div id="jp-line" className={hasPunctuation ? "has-punctuation" : ""}>{jpText}</div>
                      
                      <div id="full-roma" className={hasPunctuation ? "has-punctuation" : ""} style={{ display: showRomaji ? 'block' : 'none' }}>
                        {allSegments.map((seg, i) => (
                          <span key={i} className="segment-group">
                            {seg.display.split('').map((char, charIdx) => (
                              <span key={charIdx} style={{ opacity: charIdx < seg.inputBuffer.length ? 0.3 : 1 }}>
                                {char}
                              </span>
                            ))}
                          </span>
                        ))}
                      </div>
                  </div>
                      {bonusPopups.map(p => (<div key={p.id} className={`bonus-pop ${p.type}`}>{p.text}</div>))}
                      <div id="rank-monitor" style={{whiteSpace:'nowrap'}}>RANK <span id="rank-value" className={`rank-${rank.toLowerCase()}`}>{rank}</span></div>
                  </div>
              </div>
              <div id="combo-box">
                  <div id="combo-count" className={comboClass} data-text={combo}>{combo}</div>
                  <div id="combo-label" className={comboClass} data-text="COMBO">COMBO</div>
              </div>
              <div id="tmr-box"><img src="/images/cloud.png" id="tmr-img" alt="雲" /><span id="tmr-text" className={isTimeAdded ? "time-plus" : (timeLeft <= 10 ? "timer-pinch" : "timer-normal")}>{Math.ceil(timeLeft)}</span></div>
              <div id="combo-meter" className={`theme-${difficulty.toLowerCase()}`}><div className="meter-header"><span>連打メーター</span><span>+10秒</span></div><div id="meter-bar"><div id="meter-fill" style={{width: `${Math.min(100, (gaugeValue / gaugeMax) * 100)}%`}}></div></div></div>
              <div id="word-counter"><fieldset style={{border:'none', padding:0, margin:0}}><legend>WORDS</legend><span id="stat-words">{completedWords}</span></fieldset></div>
              <div id="hud-stats"><span className="speed-label">Speed: </span><span id="stat-speed">{currentSpeed} <span className="stat-unit">key/s</span></span></div>
            </div>
          )}

          {/* RESULT SCREEN */}
          {(gameState === 'result' || gameState === 'hiscore_review') && (
            <div id="result-screen" className={`res-theme-${difficulty.toLowerCase()}`} onClick={handleResultClick} style={{opacity: 1, zIndex: 20}}>
                
                <h2 className="result-title">RESULT</h2>
                
                <div className="result-grid">
                    <div className="result-left-col">
                        <div className={`score-big-container fade-target ${resultAnimStep >= 1 ? 'visible' : ''}`} id="res-anim-1">
                            <div className="score-header-row">
                                <div className="score-label-main">SCORE</div>
                                <div className="hiscore-block">
                                    <div id="new-record-badge" className={isNewRecord && gameState === 'result' ? "" : "hidden"}>NEW RECORD!</div>
                                    <div className="hiscore-row">
                                        <span className="hiscore-label">HI-SCORE</span>
                                        <span className="hiscore-value" id="res-hi-score">{highScore.toLocaleString()}</span> 
                                    </div>
                                    {gameState === 'result' && (
                                      <div className={`score-diff ${scoreDiff > 0 ? 'diff-plus' : scoreDiff < 0 ? 'diff-minus' : 'diff-zero'}`} id="score-diff">
                                        {scoreDiff > 0 ? "+" : ""}{scoreDiff.toLocaleString()}
                                      </div>
                                    )}
                                </div>
                            </div>
                            <div className="score-main-row" style={{width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '5px'}}>
                                <div className="score-val-huge" id="res-score" style={{textAlign:'right'}}>
                                    {targetResultData.score.toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div className={`stats-compact-container fade-target ${resultAnimStep >= 2 ? 'visible' : ''}`} id="res-anim-2">
                            <div className="stat-row"><span className="stat-label c-green">Correct</span><div className="stat-right-stacked"><span className="sub-val-upper">({targetResultData.words} words)</span><span className="stat-val c-green" id="res-correct">{targetResultData.correct}</span></div></div>
                            <div className="stat-row"><span className="stat-label c-red">Miss</span><div className="stat-right"><span className="stat-val c-red" id="res-miss">{targetResultData.miss}</span></div></div>
                            <div className="stat-row"><span className="stat-label c-blue">BackSpace</span><div className="stat-right"><span className="stat-val c-blue" id="res-bs">{targetResultData.backspace}</span></div></div>
                            <div className="stat-row"><span className="stat-label c-cyan">Speed</span><div className="stat-val-group" style={{textAlign:'right'}}><span className="stat-val c-cyan" id="res-speed">{targetResultData.speed}</span><span className="stat-unit">key/s</span></div></div>
                            <hr className="stat-divider" style={{border:0, borderTop:'1px dashed rgba(255,255,255,0.3)', margin: '5px 0'}} />
                            <div className="stat-row combo-row"><span className="stat-label c-orange">MAX COMBO</span><span className="stat-val c-orange" id="res-max-combo">{targetResultData.maxCombo}</span></div>
                        </div>
                    </div>
                    <div className="col-right">
                        <div className={`result-box weak-box fade-target ${resultAnimStep >= 3 ? 'visible' : ''}`} id="res-anim-3">
                          <div className="label-small">苦手な単語</div>
                          <ul id="weak-words-list" className="weak-list">
                            {displayWeakWords.map((item:any, idx:number) => (<li key={idx}><span>{item.word}</span> <span className="miss-count">{item.misses}ミス</span></li>))}
                            {displayWeakWords.length === 0 && <li style={{listStyle:'none', color:'#ccc', textAlign:'center', marginTop:'10px', fontSize:'0.8rem'}}>None</li>}
                          </ul>
                        </div>
                        <div className={`result-box weak-box fade-target ${resultAnimStep >= 3 ? 'visible' : ''}`} id="res-anim-4">
                          <div className="label-small">苦手なキー</div>
                          <ul id="weak-keys-list" className="weak-list horizontal-list" style={{display:'flex', flexDirection:'column'}}>
                             {displayWeakKeys.map(([char, count]:any, idx:number) => (<li key={idx} style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span>{char.toUpperCase()}</span> <span className="miss-count">{count}回</span></li>))}
                             {displayWeakKeys.length === 0 && <li style={{listStyle:'none', color:'#ccc', textAlign:'center', marginTop:'10px', fontSize:'0.8rem'}}>None</li>}
                          </ul>
                        </div>
                        <div className={`rank-area fade-target ${resultAnimStep >= 4 ? 'visible' : ''}`} id="res-anim-5">
                            <div className="rank-circle"><div className="rank-label">RANK</div><div id="res-rank" className={`rank-char res-rank-${targetResultData.rank.toLowerCase()}`}>{targetResultData.rank}</div></div>
                        </div>
                    </div>
                </div>

                <div className={`result-footer-area fade-target ${resultAnimStep >= 5 ? 'visible' : ''}`} id="res-anim-6" style={{width:'100%', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', marginTop:'10px'}}>
                    {gameState === 'result' ? (
                      <>
                        <div className="result-buttons">
                            <button id="btn-retry" className="res-btn primary" onClick={(e) => { e.stopPropagation(); retryGame(); }}>もう一度 (Enter)</button>
                            <button id="btn-Esc-to-difficulty" className="res-btn secondary" onClick={(e) => { e.stopPropagation(); backToDifficulty(); }}>難易度選択へ (Esc)</button>
                            <button id="btn-back-to-title" className="res-btn secondary" onClick={(e) => { e.stopPropagation(); backToTitle(); }}>タイトルへ</button>
                        </div>
                        <div className="result-share-group" style={{position:'absolute', right:'10px', display:'flex', gap:'10px'}}>
                            <div className="share-icon-box crown-box" onClick={(e) => { e.stopPropagation(); fetchRanking(); }} style={{ cursor: 'pointer' }} ><img src="/images/ranking.png" alt="Ranking" style={{width:'30px', height:'30px', objectFit:'contain'}} /></div>
                            <a href={getShareUrl()} target="_blank" rel="noopener noreferrer" id="btn-share-x" className="share-icon-box x-box" onClick={(e) => e.stopPropagation()}>
                              <img src="/images/X.jpg" alt="Share on X" style={{width:'30px', height:'30px', objectFit:'contain'}} />
                            </a>
                        </div>
                      </>
                    ) : (
                      <>
                          <div className="result-buttons"></div>
                          <div className="result-share-group" style={{position:'absolute', right:'10px'}}>
                            <button 
                              className="share-icon-box"
                              onClick={(e) => { e.stopPropagation(); backToDifficulty(); }}
                              style={{
                                  cursor: 'pointer', background: 'rgba(255,255,255,0.2)', border: '2px solid #fff',
                                  color: '#fff', borderRadius: '50%', width: '50px', height: '50px',
                                  display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.6rem', fontWeight: 'bold'
                              }}
                            >
                              ↩
                            </button>
                          </div>
                      </>
                    )}
                </div>
            </div>
          )}

          {/* RANKING MODAL */}
          {showRanking && (
            <div className="ranking-overlay" onClick={closeRanking}>
              <div className={`ranking-modal rank-theme-${difficulty.toLowerCase()}`} onClick={(e) => e.stopPropagation()}>
                
                <div className="ranking-header">
                  <h2 className="ranking-title">
                    {difficulty} <span style={{fontSize:'0.4em', opacity:0.8}}>{isDevRankingMode ? '- 作成者のスコア -' : ''}</span>
                  </h2>

                  <div className="ranking-header-buttons">
                    {!isDevRankingMode && (
                      <button className="close-btn dev-btn" onClick={handleShowDevScore} title="製作者スコアを見る">
                        👑
                      </button>
                    )}
                    {isDevRankingMode && (
                      <button className="close-btn global-btn" onClick={() => fetchRanking(difficulty)} title="全国ランキングに戻る">
                        🌏
                      </button>
                    )}
                    <button className="close-btn" onClick={closeRanking} title="閉じる">
                      ↩
                    </button>
                  </div>
                </div>

                <div className="ranking-list">
                  {isDevRankingMode ? (
                    // ■■■ 製作者スコア POP表示 ■■■
                    rankingData.length > 0 ? (
                      rankingData.map((item) => (
                        <div key={item.id} className="dev-score-pop-container">
                            <div className="dev-score-card" style={{color: 'inherit'}}> 
                              <button 
                                className="dev-pop-back-btn" 
                                onClick={() => {
                                  setIsDevRankingMode(false); 
                                  fetchRanking(difficulty);   
                                }}
                                title="ランキングに戻る"
                                style={{
                                    position: 'absolute', top: '15px', right: '15px', width: '30px', height: '30px',
                                    borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.3)',
                                    color: '#fff', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                ↩
                              </button>
                                <div className="dev-label">CREATOR'S RECORD</div>
                                <div className="rank-name-row" style={{justifyContent:'center', gap:'10px', marginBottom:'5px'}}>
                                    <span style={{fontSize:'1.2rem'}}>👑 {item.name}</span>
                                    <span style={{fontSize:'0.8rem', opacity:0.7}}>
                                    {(() => {
                                      const d = new Date(item.created_at);
                                      return d.toLocaleString('ja-JP', {
                                        timeZone: 'Asia/Tokyo',
                                        year: 'numeric',
                                        month: 'numeric',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      });
                                    })()}
                                    </span>
                                </div>
                                <div className="dev-main-score">
                                    {item.score.toLocaleString()}
                                </div>
                                <div className="dev-stats-grid">
                                  <div className="dev-stat-item">
                                      <span style={{color:'#4ade80'}}>Correct</span>
                                      <span className="dev-stat-val">{item.correct}</span>
                                  </div>
                                  <div className="dev-stat-item">
                                      <span style={{color:'#f87171'}}>Miss</span>
                                      <span className="dev-stat-val">{item.miss}</span>
                                  </div>
                                  <div className="dev-stat-item">
                                      <span style={{color:'#3498db'}}>BackSpace</span>
                                      <span className="dev-stat-val">{item.backspace}</span>
                                  </div>
                                  <div className="dev-stat-item">
                                      <span style={{color:'#22d3ee'}}>Speed</span>
                                      <span className="dev-stat-val">
                                          {item.speed} <span>key/s</span>
                                      </span>
                                  </div>
                                  <div className="dev-stat-item">
                                      <span style={{color:'#fbbf24'}}>MaxCombo</span>
                                      <span className="dev-stat-val">{item.combo}</span>
                                  </div>
                              </div>
                            </div>
                        </div>
                      ))
                    ) : (
                      <div className="dev-score-pop-container">
                          <p>Dev data not found...</p>
                      </div>
                    )
                  ) : (
                    // ■■■ 通常ランキングリスト表示 ■■■
                    <>
                      {rankingData.map((item, index) => {
                        const rank = index + 1;
                        const isMe = item.user_id === userId;
                        const d = new Date(item.created_at);
                        const dateStr = d.toLocaleString('ja-JP', {
                            timeZone: 'Asia/Tokyo',
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        return (
                            <div key={item.id} className={`ranking-card rank-${rank} ${isMe ? 'my-rank' : ''}`} style={{position: 'relative'}}>
                                {isMe && <div className="you-badge">YOU</div>}
                                <div className="rank-badge"><span className="rank-num">{rank}</span></div>
                                <div className="rank-info">
                                    <div className="rank-name-row"><span className="rank-name">{item.name}</span><span className="rank-date">{dateStr}</span></div>
                                    <div className="rank-score">{item.score.toLocaleString()}</div>
                                    <div className="rank-stats-grid">
                                        <div className="stat-box c-green">Correct: {item.correct}</div>
                                        <div className="stat-box c-red">Miss: {item.miss}</div>                        
                                        <div className="stat-box c-blue">BS: {item.backspace}</div>
                                        <div className="stat-box c-cyan">Speed: {item.speed}</div>
                                        <div className="stat-box c-orange">Combo: {item.combo}</div>
                                    </div>
                                </div>
                            </div>
                        );
                      })}
                      {rankingData.length === 0 && (
                        <div style={{textAlign:'center', padding:'30px', color:'#eee'}}>No Data Yet</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div> 
      </div>

      {showHowToPlay && (
        <div className="config-overlay" onClick={handleCloseHowToPlay}>
          <div className="config-modal howto-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="config-title">遊び方</h2>
            
            <div className="howto-grid-container">
              <div className="howto-col left-col">
                <h3 className="howto-heading">ルール</h3>
                <ul className="howto-list">
                  <li>
                    <span className="icon">⏰</span>
                    <span>難易度ごとに<span className="highlight-gold">制限時間</span>があります。</span>
                  </li>
                  <li>
                    <span className="icon">🌟</span>
                    <span>ミスタイプなく単語入力すると<span className="highlight-gold">ボーナス得点</span>GET！<br/>
                    <span className="note">※1回でもミスタイプすると加算されません</span></span>
                  </li>
                  <li>
                    <span className="icon">↩️</span>
                    <span>ミスタイプは<span className="highlight-blue">BackSpace</span>で消す必要があります。<br/>
                    正しく打てた場合は<span className="highlight-green">緑</span>に、ミスタイプした場合は<span className="highlight-red">赤</span>で表示されます。<br/>
                    <span className="note red-note">※赤くなってもキー入力は進みますが次の単語には進めません！修正はめんどくさいですよ！</span></span>
                  </li>
                  <li>
                    <span className="icon">🔋</span>
                    <span><span className="highlight-green">連打ゲージ</span>：正解で増加！ミスで減少...！満タンになるとタイム加算！</span>
                  </li>
                  <li>
                    <span className="icon">🌈</span>
                    <span>正確に打ち続けると<span className="highlight-gold">COMBO</span>増加！コンボ数に応じてタイムも増加！</span>
                  </li>
                  <li>
                    <span className="icon">🔥</span>
                    <span>ミスタイプでコンボ終了。スコアを伸ばして<span className="highlight-gold">全国ランキング</span>を目指そう！</span>
                  </li>
                </ul>
              </div>

              <div className="howto-col right-col">
                <h3 className="howto-heading">操作方法</h3>
                
                <div className="howto-section">
                  <p className="howto-text">
                    中央に表示されている単語をタイピング！<br/>
                    <span className="highlight-green">EASY</span>・
                    <span className="highlight-blue">NORMAL</span>・
                    <span className="highlight-red">HARD</span><br/>
                    3つの難易度があり、出題傾向が変わります。<br/>
                    お好きな難易度で挑戦してください！
                  </p>
                </div>

                <div className="howto-section" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 className="howto-heading_sub">ローマ字対応</h3>
                  <p className="howto-text note">様々な入力分岐に対応しています。</p>
                  
                  <div className="key-example-box">
                    <div className="key-row">
                      <span className="key-char">し</span><span className="key-val">si / shi</span>
                    </div>
                    <div className="key-row">
                      <span className="key-char">つ</span><span className="key-val">tu / tsu</span>
                    </div>
                    <div className="key-row">
                      <span className="key-char">ち</span><span className="key-val">ti / chi</span>
                    </div>
                    <div className="key-row">
                      <span className="key-char">ん</span><span className="key-val">n / nn</span>
                    </div>
                    <p className="note" style={{textAlign:'right', marginTop:'0.5cqh'}}>※母音の前や末尾は <span className="highlight-gold">nn</span> 必須</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="config-buttons">
              <button className="pop-btn primary" onClick={handleCloseHowToPlay}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* SETTING MODAL (Inline Edit Version) */}
      {showConfig && (
        <div className="config-overlay" onClick={handleCloseConfig}>
           <div className="config-modal" onClick={(e) => e.stopPropagation()}>
              
                {/* タイトルは外に出して固定する（スクロールしても消えない！） */}
                <h2 className="config-title" style={{marginBottom:'10px', flexShrink: 0}}>
                  SETTING
                </h2>
                
                {/* ▼▼▼ ここから下をスクロールエリアで包む ▼▼▼ */}
                <div className="config-scroll-area">
                  
                  {/* ▼▼▼ 名前設定エリア（エラー表示機能付き） ▼▼▼ */}
                  <div className="config-item" style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '5px',
                    marginBottom: '20px',
                    width: '100%',
                    padding: '0 20px'
                  }}>
                    
                    {/* ■■■ 上段：ラベルと ERROR 表示 ■■■ */}
                    <div style={{display:'flex', width:'100%', alignItems:'flex-end'}}>
                      <label style={{fontSize:'0.9rem', color:'#ccc', marginLeft:'5px'}}>
                        Player Name
                      </label>
                      
                      {/* エラーがある時だけふわっと出現 */}
                      {nameError && (
                        <span className="error-fade-in" style={{
                          fontSize: '0.9rem',
                          marginLeft: 'auto', /* 自動で右寄せ */
                          marginRight: '5px'  /* ボタンと右端を揃える */
                        }}>
                          ⚠ ERROR
                        </span>
                      )}
                    </div>
                    
                    {/* ■■■ 中段：入力フォームとボタン ■■■ */}
                    <div style={{
                      display: 'flex',
                      width: '100%',
                      gap: '10px',
                      alignItems: 'center'
                    }}>
                      <input
                        type="text"
                        // エラーがあれば赤枠＆揺れるクラスを追加
                        className={`pop-input-field ${nameError ? 'input-error-shake' : ''}`}
                        value={tempPlayerName}
                        onChange={(e) => {
                          setTempPlayerName(e.target.value);
                          if (nameError) setNameError(''); // 文字を打ったらエラーを消す
                        }}
                        maxLength={10}
                        placeholder="Guest"
                        style={{
                          flex: 1,
                          margin: 0,
                          fontSize: '1.1rem',
                          padding: '8px 20px',
                          textAlign: 'left',
                          transition: 'all 0.3s' // 色の変化を滑らかに
                        }}
                      />

                      <button 
                        className="btn-change-name" 
                        onClick={handleConfigNameSubmit}
                        style={{
                          whiteSpace: 'nowrap',
                          padding: '10px 20px',
                          fontSize: '0.9rem',
                          height: '46px'
                        }}
                      >
                        変更
                      </button>
                    </div>

                    {/* ■■■ 下段：メッセージ表示エリア ■■■ */}
                    <div style={{height: '20px', marginTop:'5px', marginLeft:'5px'}}>
                      {nameError ? (
                        // エラーメッセージ（不適切な〜）をふわっと表示
                        <p className="error-fade-in" style={{fontSize:'0.85rem', margin:0}}>
                          {nameError}
                        </p>
                      ) : (
                        // 通常時は注釈を表示
                        <p style={{fontSize:'0.8rem', color:'rgba(255,255,255,0.5)', margin:0}}>
                           ※変更可能、名前はランキングに反映されます
                        </p>
                      )}
                    </div>

                  </div>

                  <div className="config-item">
                    <label className="config-label">
                      <input 
                        type="checkbox" 
                        checked={isMuted} 
                        onChange={(e) => setIsMuted(e.target.checked)} 
                      />
                      <span className="checkbox-text">音量をミュートにする</span>
                    </label>
                  </div>

                  <div className="config-item">
                    <label className="config-label">
                      <input 
                        type="checkbox" 
                        checked={showRomaji} 
                        onChange={(e) => setShowRomaji(e.target.checked)} 
                      />
                      <span className="checkbox-text">ローマ字ガイドを表示する</span>
                    </label>
                  </div>

                  <hr style={{borderColor:'rgba(255,255,255,0.2)', margin:'20px 0'}}/>

                  <div className={`config-item ${isMuted ? 'disabled' : ''}`}>
                    <div className="slider-label-row">
                        <span>BGM音量</span>
                        <span>{Math.round(bgmVol * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.05"
                      value={bgmVol}
                      onChange={(e) => setBgmVol(parseFloat(e.target.value))}
                      disabled={isMuted}
                      className="volume-slider"
                    />
                  </div>

                  <div className={`config-item ${isMuted ? 'disabled' : ''}`}>
                    <div className="slider-label-row">
                        <span>効果音(SE)音量</span>
                        <span>{Math.round(seVol * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.05"
                      value={seVol}
                      onChange={(e) => setSeVol(parseFloat(e.target.value))}
                      disabled={isMuted}
                      className="volume-slider"
                    />
                  </div>

                  <div className="config-buttons" style={{marginTop:'30px'}}>
                    <button className="pop-btn primary" onClick={handleCloseConfig}>閉じる</button>
                  </div>
                </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;