import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import './App.css';
import { type DifficultyLevel, DIFFICULTY_SETTINGS } from './utils/setting';
import { 
  initAudio, playDecisionSound, startSelectBgm, stopSelectBgm, 
  playGameBGM, stopGameBGM, playStartSound, playFinishSound,
  playResultSound, playRankSSound, playRankASound, playRankBSound, playRankCSound, playRankDSound
} from './utils/audio';
import { drawReadyAnimation, drawGoAnimation } from './utils/transitions';
import { useTypingGame } from './hooks/useTypingGame';

const NG_WORDS = [
  // 【暴言・攻撃的】
  '死ね', '殺す', '殺し', '自殺', 'うざ', '消えろ', 'ゴミ', 'クズ', 'カス', 'キチガイ', '障害',
  
  // 【性的・卑猥】
  'sex', 'porn', 'エロ', 'セックス', 'オナニー', 'やりたい', '風俗', 'アダルト', '変態', '乳', '精子', 
  'ペニス', 'マンコ', 'クリトリス', 'バイブ', 'ホモ', 'レズ', '犯す',
  
  // 【汚物・その他】
  'うんこ', 'うんち', '糞',
  
  // 【英語のNG】
  'fuck', 'shit', 'bitch', 'asshole', 'whore', 'dick', 'pussy', 'cock'
];

const preloadImages = () => {
  const images = [
    "/images/title.png", 
    "/images/level.png", 
    "/images/cloud.png", 
    "/images/Ready.jpg",
    "/images/icon_x.svg", 
    "/images/ranking.png", 
    "/images/X.jpg", 
    "/images/ranking.png", 
    ...Object.values(DIFFICULTY_SETTINGS).map(s => s.bg)
  ];
  images.forEach(src => { const img = new Image(); img.src = src; });
};

// 難易度ごとのハイスコアを取得するヘルパー関数
const getSavedHighScore = (level: DifficultyLevel): number => {
    const key = `typing_hiscore_${level}`;
    const saved = localStorage.getItem(key);
    return saved ? parseInt(saved, 10) : 0;
};

type GameState = 'loading' | 'title' | 'difficulty' | 'playing' | 'finishing' | 'result';
type PlayPhase = 'ready' | 'go' | 'game';

function App() {
  const [gameState, setGameState] = useState<GameState>('loading');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('NORMAL');
  const [playPhase, setPlayPhase] = useState<PlayPhase>('ready');

  const [isLoaded, setIsLoaded] = useState(false);
  const [hoverDifficulty, setHoverDifficulty] = useState<DifficultyLevel | null>(null);
  const [isWhiteFade, setIsWhiteFade] = useState(false);

  // ① プレイヤー名（前回の続きがあればそれを復元、なければGuest）
  const [playerName, setPlayerName] = useState(() => {
    // ローカルストレージ（ブラウザの記憶）をチェック
    const savedName = localStorage.getItem('typing_player_name');
    // 保存データがあればそれを使う。なければ 'Guest'
    return savedName || 'Guest';
  });

  // ② 「今日、名前確認が終わったか？」のフラグ (初回プレイ判定用)
  const [isNameConfirmed, setIsNameConfirmed] = useState(false);

  // ③ タイトル画面の状態 ('normal'=ロゴ表示中, 'input'=名前入力中)
  const [titlePhase, setTitlePhase] = useState<'normal' | 'input' | 'confirm'>('normal');

  // ★追加：ユーザーID（ブラウザごとの固有ID）
  const [userId] = useState(() => {
    // 保存されたIDがあるか探す
    let id = localStorage.getItem('typing_user_id');
    // なければ新しく作って保存（これが会員証発行！）
    if (!id) {
      id = crypto.randomUUID(); 
      localStorage.setItem('typing_user_id', id);
    }
    return id;
  });

  // 遷移中フラグ
  const [isTransitioning, setIsTransitioning] = useState(false);
  // 操作ロックフラグ (アニメーション中の連打防止)
  const [isInputLocked, setIsInputLocked] = useState(true); //最初はロード中なのでロック

  // タイトルアニメーション用
  const [showTitle, setShowTitle] = useState(false);
  const [enableBounce, setEnableBounce] = useState(false);
  const [isTitleExiting, setIsTitleExiting] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle'); //データ保存用

  // --- ランキング機能 ---
  const [rankingData, setRankingData] = useState<any[]>([]); // データを入れる箱
  const [showRanking, setShowRanking] = useState(false);     // 画面を表示するフラグ

  // リザルト・スコア関連
  const [highScore, setHighScore] = useState(0); 
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [scoreDiff, setScoreDiff] = useState(0);
  
  // リザルトアニメーション管理
  const [resultAnimStep, setResultAnimStep] = useState(0);
  const resultTimersRef = useRef<number[]>([]);
  const hasSaved = useRef(false); // 保存したかどうかを覚えておく変数

  const [isFinishExit, setIsFinishExit] = useState(false);

  const { 
    score, displayScore, combo, comboClass, timeLeft, jpText, romaState, 
    handleKeyInput, handleBackspace, startGame, resetGame,
    gaugeValue, gaugeMax, 
    rank, correctCount, missCount, maxCombo, completedWords, backspaceCount,
    allSegments, shakeStatus, 
    missedWordsRecord, missedCharsRecord, isTimeAdded, isRainbowMode, bonusPopups, perfectPopups, scorePopups,
    setElapsedTime, currentSpeed,
    setTimeLeft 
  } = useTypingGame(difficulty);

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

  // 初期ロード
  useEffect(() => {
    preloadImages();
    initAudio();
    const img = new Image();
    img.src = "/images/Ready.jpg";
    img.onload = () => { readyImageRef.current = img; };

    // ロード完了シーケンス
    setTimeout(() => {
      setIsLoaded(true);
      setGameState('title');
      
      // タイトル表示アニメーション
      setTimeout(() => { 
          setShowTitle(true); 
          // さらにバウンド開始
          setTimeout(() => {
              setEnableBounce(true);
              // アニメーションが終わった頃にロック解除
              setIsInputLocked(false);
          }, 1200);
      }, 500); 
    }, 1500);
  }, []);

  // ① スタート時の処理（クリック・スペースキー共通）
  const handleStartSequence = () => {
    // アニメーション中などは操作を受け付けない
    if (isTitleExiting || isInputLocked) return;

    // A. 名前確認済みなら → そのまま難易度選択へ (既存の通り)
    if (isNameConfirmed) {
      goToDifficulty();
      return;
    }

    // B. 初回なら → 名前入力画面へ
    // ★ここを変更！いきなり表示せず、まずはタイトルを退場させる
    playDecisionSound();
    setIsInputLocked(true);  // 連打防止
    setIsTitleExiting(true); // タイトルとボタンを画面外へ飛ばすアニメ開始

    // アニメーションが終わるのを待ってから (0.8秒後)、入力欄を表示
    setTimeout(() => {
      setIsTitleExiting(false); // アニメ状態解除
      setIsInputLocked(false);  // ロック解除
      setTitlePhase('input');   // ★ここで初めて入力欄を表示！
    }, 700);
  };

const handleNameSubmit = () => {
  const trimmedName = playerName.trim();
  const MAX_LENGTH = 10; //10文字制限
  
  // ① 空文字チェック（スペースのみも禁止）
  if (!trimmedName) {
    // プレイネームを空にして、プレースホルダーを表示させるか、Guestにする
    setPlayerName('Guest'); 
    // ※あるいは alert("名前を入力してください"); return; でもOK
  }

  // ② ★追加：文字数オーバーのチェック
  if (trimmedName.length > MAX_LENGTH) {
    alert(`名前は${MAX_LENGTH}文字以内で入力してください！(現在${trimmedName.length}文字)`);
    return; // ここで止める
  }

  // ③ NGワードチェック（実装済み）
  const isNg = NG_WORDS.some(word => 
    trimmedName.toLowerCase().includes(word.toLowerCase())
  );
  if (isNg) {
    alert("その名前は使用できません（不適切な言葉が含まれています）🙅‍♂️");
    setPlayerName(""); 
    return; 
  }

  // --- 全てクリアしたら次へ ---
  
  // 入力欄の見た目をトリム済みのきれいな名前に更新しておく
  setPlayerName(trimmedName || 'Guest');
  
  playDecisionSound();
  setTitlePhase('confirm');
};

// ② 確認画面で「これでOK」を押した時の処理（★新規追加）
const handleFinalConfirm = () => {
  // ここで初めて保存！
  localStorage.setItem('typing_player_name', playerName);
  playDecisionSound();
  startSelectBgm();
  
  // 即座に難易度選択へ移動
  setIsNameConfirmed(true);
  setGameState('difficulty');
  setTitlePhase('normal');
};

// ③ 確認画面で「戻る」を押した時の処理（★新規追加）
const handleBackToInput = () => {
  playDecisionSound();
  // 入力画面に戻す
  setTitlePhase('input');
};

  // リサイズ
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

  // タイマー
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

  // ゲーム終了検知
  useEffect(() => {
    if (gameState === 'playing' && playPhase === 'game' && timeLeft <= 0) {
        stopGameBGM();
        playFinishSound();
        setGameState('finishing');
        
        setIsFinishExit(false); 
        setIsWhiteFade(false);

        // ハイスコア判定（演出用）
        const currentSaved = getSavedHighScore(difficulty);
        if (score > currentSaved) {
            setIsNewRecord(true);
        } else {
            setIsNewRecord(false);
        }

        // 演出シーケンス
        setTimeout(() => setIsFinishExit(true), 1500);
        setTimeout(() => setIsWhiteFade(true), 2000);
        setTimeout(() => {
            setGameState('result');
            setIsWhiteFade(false);
            setIsFinishExit(false);
        }, 2500);
    }
  }, [timeLeft, gameState, playPhase, score, highScore, difficulty]);

const saveScore = useCallback(async () => {
    if (saveStatus === 'saving' || saveStatus === 'success') return;
    if (score <= 0) {
        setSaveStatus('success'); 
        return;
    }

    setSaveStatus('saving');

    try {
      // ① ★変更：名前ではなく「ユーザーID」で過去の自分を探す
      const { data: existingData, error: fetchError } = await supabase
        .from('scores')
        .select('*')
        .eq('user_id', userId) // ★IDが一致するデータを探す
        .eq('difficulty', difficulty)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
         throw fetchError;
      }

      // ② 自分のデータが見つかった場合
      if (existingData) {
        // 自己ベスト更新なら上書き
        if (score > existingData.score) {
          console.log("ハイスコア更新！");
          const { error: updateError } = await supabase
            .from('scores')
            .update({
               name: playerName, // 名前を変えていたらここも更新される
               score: score,
               correct: correctCount,
               miss: missCount,
               backspace: backspaceCount,
               combo: maxCombo,
               speed: currentSpeed,
            })
            .eq('id', existingData.id); // レコードIDで指定して更新

          if (updateError) throw updateError;
        }
      } 
      // ③ 新規データの場合
      else {
        console.log("新規データ作成");
        const { error: insertError } = await supabase
          .from('scores')
          .insert([{
            user_id: userId, // ★ここで会員証IDを書き込む
            name: playerName,
            difficulty: difficulty,
            score: score,
            correct: correctCount,
            miss: missCount,
            backspace: backspaceCount,
            combo: maxCombo,
            speed: currentSpeed,
          }]);
          
        if (insertError) throw insertError;
      }

      setSaveStatus('success');

    } catch (error: any) {
      console.error('❌ 保存エラー:', error.message);
      setSaveStatus('error');
    }
  }, [difficulty, score, correctCount, missCount, backspaceCount, maxCombo, currentSpeed, saveStatus, playerName, userId]);

const fetchRanking = async (targetDiff?: DifficultyLevel) => {
  // 引数があればそれを、なければ今の difficulty state を使う
  const searchDiff = targetDiff || difficulty; 
  
  // ★重要：モーダルのタイトルがズレないように、stateも更新しておく
  if (targetDiff) {
    setDifficulty(targetDiff);
  }

  console.log("ランキング取得開始:", searchDiff);
  
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('difficulty', searchDiff) // ★ここを searchDiff に変更
    .order('score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('ランキング取得エラー:', error);
  } else {
    setRankingData(data || []);
    setShowRanking(true);
  }
};

const closeRanking = () => {
  setShowRanking(false);
};

  // リザルト画面のアニメーション制御 & データ保存
  useEffect(() => {
    if (gameState === 'result') {
        // まだ保存していなければ実行
        if (!hasSaved.current) {
          saveScore();
          hasSaved.current = true; // 1回送ったら「保存済み」にする
        }
        
        const storageKey = `typing_hiscore_${difficulty}`;
        const savedScore = parseInt(localStorage.getItem(storageKey) || "0", 10);

        let diff = 0;
        if (score > savedScore) {
            setIsNewRecord(true);
            setHighScore(score); // 今回のスコアをハイスコアとして表示
            localStorage.setItem(storageKey, score.toString());
            diff = score - savedScore;
        } else {
            setIsNewRecord(false);
            setHighScore(savedScore); // 過去のハイスコアを表示
            diff = score - savedScore;
        }
        setScoreDiff(diff);

        // アニメーション開始
        setResultAnimStep(0);
        resultTimersRef.current = [];

        const schedule = [
            { step: 1, delay: 600, sound: playResultSound },
            { step: 2, delay: 1300, sound: playResultSound },
            { step: 3, delay: 2000, sound: playResultSound },
            { step: 4, delay: 3500, sound: () => {
                if (rank === 'S') playRankSSound();
                else if (rank === 'A') playRankASound();
                else if (rank === 'B') playRankBSound();
                else if (rank === 'C') playRankCSound();
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
  }, [gameState, score, difficulty, rank]);

  // スキップ機能
  const handleResultClick = () => {
      if (gameState === 'result' && resultAnimStep < 5) {
          resultTimersRef.current.forEach(clearTimeout);
          resultTimersRef.current = [];
          
          setResultAnimStep(5);
          
          if (rank === 'S') playRankSSound();
          else if (rank === 'A') playRankASound();
          else if (rank === 'B') playRankBSound();
          else if (rank === 'C') playRankCSound();
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
          state.readyY += 15;
          if (state.readyY >= 0) {
            state.readyY = 0;
            state.isReadyAnimating = false;
            state.showEnterText = true;
          }
        }
        drawReadyAnimation(ctx, canvas.width, canvas.height, state.readyY, readyImageRef.current, state.showEnterText);
      }
      else if (playPhase === 'go') {
        // すでにfalseなら何もしない、trueの時だけ1回リセットする
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

  // --- 画面遷移アクション ---
  const resetToReady = () => {
    playDecisionSound();
    stopGameBGM(); 
    resetGame(); 
    hasSaved.current = false;
    setSaveStatus('idle'); // ★ここに追加！
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
    stopGameBGM();
    startSelectBgm();
    setGameState('difficulty');
    setIsTransitioning(false);
  };

  const retryGame = () => {
      // 難易度再選択と同じ処理
      if (isTransitioning) return;
      setSaveStatus('idle'); //表示状態を元に戻す
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
          hasSaved.current = false; // ★次のプレイのためにリセット！
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
    // ロック中は無視
    if (isTitleExiting || isInputLocked) return;
    
    playDecisionSound();
    setIsInputLocked(true); // ロック開始
    setIsTitleExiting(true);

    setTimeout(() => {
        startSelectBgm();
        setGameState('difficulty');
        setIsTitleExiting(false);
        
        // 難易度画面が表示されたらロック解除 (フェード時間を考慮)
        setTimeout(() => setIsInputLocked(false), 500);
    }, 600);
  };

  // キーボード操作の監視
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // e.stopImmediatePropagation(); // 必要ならコメントイン

      // 特殊キーやIME入力中の除外処理
      if (e.key !== "Escape") {
         if (["Shift", "Alt", "Meta", "Control", "Tab", "CapsLock", "Insert", "Delete", "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) || e.key.startsWith("F")) return;
      }
      if (e.isComposing || ["Process", "KanaMode", "Conversion", "NonConvert"].includes(e.code)) return;

      // ★★★ ここから下、消えていたゲーム操作を復活！ ★★★
      const state = animState.current;

      // READYフェーズ（Enterで開始）
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

      // GAMEフェーズ（タイピング入力）
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

      // RESULTフェーズ
      else if (gameState === 'result') {
          handleResultKeyAction(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
    
    // 依存配列
  }, [gameState, playPhase, startGame, difficulty, resultAnimStep, handleStartSequence]);

  const handleSelectDifficulty = (diff: DifficultyLevel) => {
    // ロック中は無視
    if (isTransitioning || isInputLocked) return;
    
    setIsTransitioning(true);
    setIsInputLocked(true); // ロック

    playDecisionSound();
    setDifficulty(diff);
    resetGame();
    setSaveStatus('idle'); // ★ここに追加！
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
        // ゲーム画面に行ったらロック解除
        setIsInputLocked(false);
        hasSaved.current = false; // ここでリセット
    }, 50);
  };

  const backToTitle = () => {
    playDecisionSound();
    stopSelectBgm();
    stopGameBGM();
    hasSaved.current = false;
    setSaveStatus('idle'); // ★ここに追加！
    
    setGameState('title');
    setShowTitle(false); 
    setEnableBounce(false);
    setIsTitleExiting(false);
    
    // タイトルに戻るときもロックしてアニメーションさせる
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

  // 表示する難易度情報 (hoverDifficulty が null の場合は、直前にホバーして setDifficulty された difficulty を表示)
  const displayDiff = hoverDifficulty || difficulty;
  
  // ハイスコアの表示値。現在表示している難易度に対応するスコアを取得
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

  // 句読点判定
  const hasPunctuation = jpText.endsWith('。') || jpText.endsWith('、');

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
              
              {/* --- 通常のタイトル画面 (入力・確認モード中は退場アニメ) --- */}
              <div 
                 className={`title-content-wrapper ${titlePhase !== 'normal' ? 'exit' : 'enter'}`}
                 style={{display: 'flex', flexDirection:'column', alignItems:'center', width:'100%'}}
              >
                  {/* ★修正1: isTitleExiting を追加 */}
                  <div className={`title-anim-wrapper ${showTitle ? 'visible' : ''} ${(titlePhase !== 'normal' || isTitleExiting) ? 'exit-up' : ''}`}>
                      <h1 className={`game-title ${enableBounce ? 'bouncing' : ''}`}>CRITICAL TYPING</h1>
                  </div>

                  {/* ★修正2: isTitleExiting を追加 */}
                  <div className={`main-menu-buttons fade-element ${showTitle ? 'visible' : ''} ${(titlePhase !== 'normal' || isTitleExiting) ? 'exit-down' : ''}`}>
                    <button className="menu-btn" onClick={(e) => { e.stopPropagation(); handleStartSequence(); }}>ゲームスタート</button>
                    <button className="menu-btn">遊び方</button>
                    <button className="menu-btn">設定</button>
                  </div>
              </div>

              {/* --- 名前入力モード (ポップなUI) --- */}
              {titlePhase === 'input' && (
                <div className="pop-modal-frame fade-in-pop" onClick={e => e.stopPropagation()}>
                  <label className="pop-label">名前を入力して下さい</label>
                  <input
                    type="text"
                    className="pop-input"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={10}
                    placeholder="Guest"
                    autoFocus
                  />
                  <div style={{marginTop:'25px'}}>
                    <button className="pop-btn primary" onClick={handleNameSubmit}>OK</button>
                  </div>
                  <p className="pop-note">※名前はあとからでも変更出来ます</p>
                </div>
              )}

              {/* --- 確認モード (ポップなUI) --- */}
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
                {/* isInputLocked時は no-click */}
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
                              <span className="label">HI-SCORE</span>
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
              <div id="finish-banner" className={`${gameState === 'finishing' ? "show" : ""} ${isFinishExit ? "exit" : ""}`}>FINISH!</div>
              <div id="score-container">
                  SCORE: <span id="score">{displayScore}</span>
                  <div id="score-popups">{scorePopups.map(p => (<div key={p.id} className={`score-popup ${p.type}`}>{p.text}</div>))}</div>
              </div>
              <div id="perfect-container">{perfectPopups.map(p => (<div key={p.id} className="perfect-item">PERFECT!!</div>))}</div>
              <div id="center-area" style={{ opacity: (playPhase === 'game' && gameState !== 'finishing') ? 1 : 0, transition: 'opacity 0.2s' }}>
                  <div id="text-word-wrapper">
                      <div id="text-word" className={shakeStatus === 'light' ? "light-shake" : shakeStatus === 'error' ? "error-shake" : ""}>
                          <div id="romaji-line">
                              {romaState.typedLog.map((log, i) => (<span key={i} style={{color: log.color}}>{log.char}</span>))}
                              <span className="text-yellow" style={{textDecoration:'underline'}}>{romaState.current}</span>
                              <span style={{color:'white'}}>{romaState.remaining}</span>
                          </div>
                          {/* 句読点判定クラスを付与 */}
                          <div id="jp-line" className={hasPunctuation ? "has-punctuation" : ""}>{jpText}</div>
                          <div id="full-roma" className={hasPunctuation ? "has-punctuation" : ""}>
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
          {gameState === 'result' && (
            <div id="result-screen" className={`res-theme-${difficulty.toLowerCase()}`} onClick={handleResultClick} style={{opacity: 1, zIndex: 20}}>
              <h2 className="result-title">RESULT</h2>
              <div className="result-grid">
                  <div className="result-left-col">
                      <div className={`score-big-container fade-target ${resultAnimStep >= 1 ? 'visible' : ''}`} id="res-anim-1">
                          <div className="score-header-row">
                              <div className="score-label-main">SCORE</div>
                              <div className="hiscore-block">
                                  <div id="new-record-badge" className={isNewRecord ? "" : "hidden"}>NEW RECORD!</div>
                                  <div className="hiscore-row">
                                      <span className="hiscore-label">HI-SCORE</span>
                                      <span className="hiscore-value" id="res-hi-score">{highScore.toLocaleString()}</span> 
                                  </div>
                                  <div className={`score-diff ${scoreDiff > 0 ? 'diff-plus' : scoreDiff < 0 ? 'diff-minus' : 'diff-zero'}`} id="score-diff">
                                    {scoreDiff > 0 ? "+" : ""}{scoreDiff.toLocaleString()}
                                  </div>
                              </div>
                          </div>
                          <div className="score-main-row" style={{width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '5px'}}>
                              <div className="score-val-huge" id="res-score" style={{textAlign:'right'}}>{score.toLocaleString()}</div>
                          </div>
                      </div>
                      <div className={`stats-compact-container fade-target ${resultAnimStep >= 2 ? 'visible' : ''}`} id="res-anim-2">
                          <div className="stat-row"><span className="stat-label c-green">Correct</span><div className="stat-right-stacked"><span className="sub-val-upper">({completedWords} words)</span><span className="stat-val c-green" id="res-correct">{correctCount}</span></div></div>
                          <div className="stat-row"><span className="stat-label c-red">Miss</span><div className="stat-right"><span className="stat-val c-red" id="res-miss">{missCount}</span></div></div>
                          <div className="stat-row"><span className="stat-label c-blue">BackSpace</span><div className="stat-right"><span className="stat-val c-blue" id="res-bs">{backspaceCount}</span></div></div>
                          <div className="stat-row"><span className="stat-label c-cyan">Speed</span><div className="stat-val-group" style={{textAlign:'right'}}><span className="stat-val c-cyan" id="res-speed">{currentSpeed}</span><span className="stat-unit">key/s</span></div></div>
                          <hr className="stat-divider" style={{border:0, borderTop:'1px dashed rgba(255,255,255,0.3)', margin: '5px 0'}} />
                          <div className="stat-row combo-row"><span className="stat-label c-orange">MAX COMBO</span><span className="stat-val c-orange" id="res-max-combo">{maxCombo}</span></div>
                      </div>
                  </div>
                  <div className="col-right">
                      <div className={`result-box weak-box fade-target ${resultAnimStep >= 3 ? 'visible' : ''}`} id="res-anim-3">
                        <div className="label-small">苦手な単語</div>
                        <ul id="weak-words-list" className="weak-list">
                          {sortedWeakWords.map((item, idx) => (<li key={idx}><span>{item.word}</span> <span className="miss-count">{item.misses}ミス</span></li>))}
                          {sortedWeakWords.length === 0 && <li style={{listStyle:'none', color:'#ccc', textAlign:'center', marginTop:'10px', fontSize:'0.8rem'}}>Perfect! 苦手なし</li>}
                        </ul>
                      </div>
                      <div className={`result-box weak-box fade-target ${resultAnimStep >= 3 ? 'visible' : ''}`} id="res-anim-4">
                        <div className="label-small">苦手なキー</div>
                        <ul id="weak-keys-list" className="weak-list horizontal-list" style={{display:'flex', flexDirection:'column'}}>
                           {sortedWeakKeys.map(([char, count], idx) => (<li key={idx} style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span>{char.toUpperCase()}</span> <span className="miss-count">{count}回</span></li>))}
                           {sortedWeakKeys.length === 0 && <li style={{listStyle:'none', color:'#ccc', textAlign:'center', marginTop:'10px', fontSize:'0.8rem'}}>None</li>}
                        </ul>
                      </div>
                      <div className={`rank-area fade-target ${resultAnimStep >= 4 ? 'visible' : ''}`} id="res-anim-5">
                          <div className="rank-circle"><div className="rank-label">RANK</div><div id="res-rank" className={`rank-char res-rank-${rank.toLowerCase()}`}>{rank}</div></div>
                      </div>
                  </div>
              </div>
              <div className={`result-footer-area fade-target ${resultAnimStep >= 5 ? 'visible' : ''}`} id="res-anim-6" style={{width:'100%', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', marginTop:'10px'}}>
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
              </div>
            </div>
          )}
        </div>
        {/* ランキングモーダル */}
        {showRanking && (
        <div className="ranking-overlay" onClick={closeRanking}>
          {/* ↓ className に動的なテーマクラスを追加しました */}
          <div 
            className={`ranking-modal rank-theme-${difficulty.toLowerCase()}`} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="ranking-header">
              {/* タイトル文字色は白の方が見やすいので style を削除してCSSで制御します */}
              <h2 className="ranking-title">
                {difficulty}
              </h2>
              <button className="close-btn" onClick={closeRanking}>↩</button>
            </div>

            {/* リスト部分 */}
            <div className="ranking-list">
              {rankingData.map((item, index) => {
                const rank = index + 1;
                
                // ★判定ロジック追加：自分かどうか？
                const isMe = item.name === playerName;

                const dateObj = new Date(item.created_at);
                const year = dateObj.getFullYear();
                const month = dateObj.getMonth() + 1;
                const day = dateObj.getDate();
                const hours = dateObj.getHours().toString().padStart(2, '0');
                const minutes = dateObj.getMinutes().toString().padStart(2, '0');
                const dateStr = `${year}/${month}/${day} ${hours}:${minutes}`;

                return (
                  // ★クラス名に条件追加：自分なら 'my-rank' クラスをつける
                  <div key={item.id} className={`ranking-card rank-${rank} ${isMe ? 'my-rank' : ''}`}style={{ position: 'relative' }}>
                    
                    {/* ★自分なら「YOU」バッジを表示 */}
                    {isMe && <div className="you-badge">YOU</div>}

                    {/* 左側：順位 */}
                    <div className="rank-badge">
                      <span className="rank-num">{rank}</span>
                    </div>

                    {/* 中央：メイン情報 */}
                    <div className="rank-info">
                      <div className="rank-name-row">
                        <span className="rank-name">{item.name}</span>
                        <span className="rank-date">{dateStr}</span>
                      </div>
                      
                      {/* スコア */}
                      <div className="rank-score">{item.score.toLocaleString()}</div>
                      
                      {/* 詳細ステータス */}
                      <div className="rank-stats-grid">
                        <div className="stat-box c-green">Correct: {item.correct}</div>
                        <div className="stat-box c-red">Miss: {item.miss}</div>                      
                        <div className="stat-box c-blue">BS: {item.backspace}</div>
                        <div className="stat-box c-cyan">Speed: {item.speed}</div>
                        <div className="stat-box c-orange">MaxCombo: {item.combo}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {rankingData.length === 0 && (
                <div style={{textAlign:'center', padding:'20px', fontFamily:'"Arial Rounded MT Bold", sans-serif'}}>No Data Yet</div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default App;