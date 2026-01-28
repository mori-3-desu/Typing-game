import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { DatabaseService } from "./services/database";
import "./App.css";

// --- Components ---
import { TitleScreen } from "./components/screens/TitleScreen";
import { DifficultySelectScreen } from "./components/screens/Difficulty";
import { GameScreen } from "./components/screens/GameScreen";
import { ResultScreen } from "./components/screens/ResultScreen";
import { Ranking } from "./components/modals/Ranking";
import { HowToPlay } from "./components/modals/HowToPlay";
import { Setting } from "./components/modals/Setting";

// --- Utils & Hooks ---
import {
  DIFFICULTY_SETTINGS,
  PLAYER_NAME_CHARS,
  UI_TIMINGS,
  DISPLAY_SCALE,
  STORAGE_KEYS,
  READY_GO_ANIMATION,
  LIMIT_DATA,
} from "./utils/setting";

import { createGameStats } from "./utils/gameUtils";

// --- utils & hooks ---
import {
  initAudio,
  playSE,
  playBGM,
  stopBGM,
  startSelectBgm,
  setVolumes,
} from "./utils/audio";
import { useConfig } from "./hooks/useConfig";
import { drawReadyAnimation, drawGoAnimation } from "./utils/canvas";
import { useTypingGame } from "./hooks/useTypingGame";
import { useGameResult } from "./hooks/useGameResult"; // ★追加
import { getSavedHighScore, getSavedHighScoreResult } from "./utils/storage";
import {
  type DifficultyLevel,
  type WordDataMap,
  type GameResultStats,
  type RankingScore,
  type TitlePhase,
} from "./types";

// ゲーム始まる前に取得
const preloadImages = () => {
  const images = [
    "/images/title.png",
    "/images/level.png",
    "/images/cloud.png",
    "/images/Ready.jpg",
    "/images/X.jpg",
    "/images/ranking.png",
    "/images/X.jpg",
    ...Object.values(DIFFICULTY_SETTINGS).map((s) => s.bg),
  ];
  images.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};

type GameState =
  | "loading"
  | "title"
  | "difficulty"
  | "playing"
  | "finishing"
  | "result"
  | "hiscore_review";
type PlayPhase = "ready" | "go" | "game";

function App() {
  const {
    isMuted,
    setIsMuted,
    bgmVol,
    setBgmVol,
    seVol,
    setSeVol,
    showRomaji,
    setShowRomaji,
  } = useConfig();

  const [nameError, setNameError] = useState("");

  const [gameState, setGameState] = useState<GameState>("loading");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("NORMAL");
  const [playPhase, setPlayPhase] = useState<PlayPhase>("ready");

  const [, setIsLoaded] = useState(false);
  const [hoverDifficulty, setHoverDifficulty] =
    useState<DifficultyLevel | null>(null);
  const [isWhiteFade, setIsWhiteFade] = useState(false);

  // ★ Hook呼び出し (リザルト・スコア管理)
  const {
    highScore,
    isNewRecord,
    scoreDiff,
    resultAnimStep,
    saveScore,
    processResult,
    playResultAnimation,
    handleResultKeyAction,
    skipAnimation,
    resetResultState,
  } = useGameResult(difficulty);

  // プレイヤー名
  const [playerName, setPlayerName] = useState(() => {
    const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
    return savedName || "";
  });

  const [isNameConfirmed, setIsNameConfirmed] = useState(() => {
    const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
    return !!savedName;
  });

  const [ngWordsList, setNgWordsList] = useState<string[]>([]);
  const [titlePhase, setTitlePhase] = useState<TitlePhase>("normal");
  const [userId, setUserId] = useState("");

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
      } else {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error("❌ ログイン失敗:", error.message);
        } else if (data.user) {
          setUserId(data.user.id);
        }
      }
    };
    initAuth();
  }, []);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInputLocked, setIsInputLocked] = useState(true);
  const [showTitle, setShowTitle] = useState(false);
  const [enableBounce, setEnableBounce] = useState(false);
  const [isTitleExiting, setIsTitleExiting] = useState(false);

  // ランキング
  const [rankingData, setRankingData] = useState<RankingScore[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const [isDevRankingMode, setIsDevRankingMode] = useState(false);

  // データ
  const [dbWordData, setDbWordData] = useState<WordDataMap | null>(null);

  // 閲覧モード用 & 直前の結果保持
  const [reviewData, setReviewData] = useState<GameResultStats | null>(null);
  const [lastGameStats, setLastGameStats] = useState<GameResultStats | null>(
    null,
  );

  const [isFinishExit, setIsFinishExit] = useState(false);

  // useTypingGame Hook
  const {
    score,
    displayScore,
    combo,
    comboClass,
    timeLeft,
    jpText,
    romaState,
    handleKeyInput,
    handleBackspace,
    startGame,
    resetGame,
    gaugeValue,
    gaugeMax,
    rank,
    correctCount,
    missCount,
    maxCombo,
    completedWords,
    backspaceCount,
    allSegments,
    shakeStatus,
    missedWordsRecord,
    missedCharsRecord,
    isTimeAdded,
    isRainbowMode,
    bonusPopups,
    perfectPopups,
    scorePopups,
    tick,
    currentSpeed,
  } = useTypingGame(difficulty, dbWordData);

  // 単語ごとのミス追跡
  const currentWordMissRef = useRef(0);
  const prevMissCountRef = useRef(0);
  const prevWordRef = useRef("");

  useEffect(() => {
    if (jpText !== prevWordRef.current) {
      currentWordMissRef.current = 0;
      prevWordRef.current = jpText;
    }
    if (missCount > prevMissCountRef.current) {
      currentWordMissRef.current += missCount - prevMissCountRef.current;
    }
    prevMissCountRef.current = missCount;
  }, [missCount, jpText]);

  // 初期データロード
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { formattedData, ngList } =
          await DatabaseService.fetchAllGameData();
        setDbWordData(formattedData);
        setNgWordsList(ngList);
      } catch (err) {
        console.error("初期データ取得失敗", err);
      }
    };
    fetchInitialData();
  }, []);

  // --- Modal Handlers ---
  const [showConfig, setShowConfig] = useState(false);
  const handleOpenConfig = () => {
    playSE("decision");
    setShowConfig(true);
  };
  const handleCloseConfig = () => {
    playSE("decision");
    setShowConfig(false);
  };

  const handleSaveName = async (newName: string) => {
    const finalName = newName || "Guest";
    setPlayerName(finalName);
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, finalName);
    try {
      await DatabaseService.updateUserName(userId, finalName);
    } catch (err) {
      console.error("名前更新エラー:", err);
    }
  };

  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const handleOpenHowToPlay = () => {
    playSE("decision");
    setShowHowToPlay(true);
  };
  const handleCloseHowToPlay = () => {
    playSE("decision");
    setShowHowToPlay(false);
  };

  // Ref更新
  const handleKeyInputRef = useRef(handleKeyInput);
  const handleBackspaceRef = useRef(handleBackspace);
  useEffect(() => {
    handleKeyInputRef.current = handleKeyInput;
    handleBackspaceRef.current = handleBackspace;
  }, [handleKeyInput, handleBackspace]);

  // Animation Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const readyImageRef = useRef<HTMLImageElement | null>(null);
  const animationState = useRef({
    readyY: -READY_GO_ANIMATION.INIT,
    isReadyAnimating: false,
    showEnterSpaceText: false,
    showGoText: false,
    goScale: READY_GO_ANIMATION.GO_INIT,
    phase: "idle",
  });

  // 初期化・ローディング
  useEffect(() => {
    preloadImages();
    initAudio();
    const img = new Image();
    img.src = "/images/Ready.jpg";
    img.onload = () => {
      readyImageRef.current = img;
    };

    const startTime = Date.now();
    const checkLoad = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      if (dbWordData && elapsedTime > UI_TIMINGS.MIN_LOADING_TIME) {
        clearInterval(checkLoad);
        setIsLoaded(true);
        setGameState("title");
        setTimeout(() => {
          setShowTitle(true);
          setTimeout(() => {
            setEnableBounce(true);
            setIsInputLocked(false);
          }, UI_TIMINGS.TITLE.BOUNCE_DELAY);
        }, UI_TIMINGS.TITLE.SHOW_DELAY);
      }
    }, 100);
    return () => clearInterval(checkLoad);
  }, [dbWordData]);

  // 音量設定
  useEffect(() => {
    setVolumes(bgmVol, seVol);
    localStorage.setItem(STORAGE_KEYS.VOLUME_BGM, bgmVol.toString());
    localStorage.setItem(STORAGE_KEYS.VOLUME_SE, seVol.toString());
  }, [bgmVol, seVol]);

  // タイトル入力処理
  const handleStartSequence = () => {
    if (isTitleExiting || isInputLocked) return;
    if (isNameConfirmed) {
      goToDifficulty();
      return;
    }
    playSE("decision");
    setIsInputLocked(true);
    setIsTitleExiting(true);
    setTimeout(() => {
      setIsTitleExiting(false);
      setIsInputLocked(false);
      setNameError("");
      setTitlePhase("input");
    }, UI_TIMINGS.TITLE.BUTTON_FADE_OUT);
  };

  const handleCancelInput = () => {
    playSE("decision");
    setTitlePhase("normal");
  };

  const handleNameSubmit = () => {
    const trimmedName = playerName.trim();
    setNameError("");
    if (trimmedName && trimmedName.length > PLAYER_NAME_CHARS.MAX) {
      setNameError(`名前は${PLAYER_NAME_CHARS.MAX}文字以内で入力してください`);
      return;
    }
    const isNg = ngWordsList.some((word) =>
      trimmedName.toLowerCase().includes(word.toLowerCase()),
    );
    if (isNg) {
      setNameError("不適切な文字が含まれています");
      return;
    }
    setPlayerName(trimmedName || "Guest");
    playSE("decision");
    setTitlePhase("confirm");
  };

  const handleFinalConfirm = () => {
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, playerName);
    playSE("decision");
    startSelectBgm();
    setIsNameConfirmed(true);
    setGameState("difficulty");
    setTitlePhase("normal");
  };

  const handleBackToInput = () => {
    playSE("decision");
    setTitlePhase("input");
  };

  // リサイズ
  useEffect(() => {
    const handleResize = () => {
      const scaler = document.getElementById("scaler");
      if (scaler) {
        const scale = Math.min(
          window.innerWidth / DISPLAY_SCALE.WIDTH,
          window.innerHeight / DISPLAY_SCALE.HEIGHT,
        );
        scaler.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // タイマー
  useEffect(() => {
    let interval: number;
    if (gameState === "playing" && playPhase === "game" && timeLeft > 0) {
      interval = window.setInterval(() => {
        tick(UI_TIMINGS.GAME.TIMER_DECREMENT);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [gameState, playPhase, timeLeft, tick]);

  // ★ ゲーム終了判定 & データ処理
  useEffect(() => {
    if (gameState === "playing" && playPhase === "game" && timeLeft <= 0) {
      stopBGM();
      playSE("finish");

      // --- 1. 集計用Mapの作成 ---
      // 同じ単語が複数回出てきた場合にミス数を合算するため、Map（辞書）を使用
      // 例: [{word: "apple", misses: 1}, {word: "apple", misses: 2}] -> {"apple" => 3}
      const weakWordMap = new Map<string, number>();

      // --- 2. 過去データの取り込み ---
      // 確定済みのミス記録（missedWordsRecord）をMapに展開
      missedWordsRecord.forEach(({ word, misses }) => {
        // すでに登録済みなら加算、なければ新規登録 (|| 0 でundefined対策)
        weakWordMap.set(word, (weakWordMap.get(word) || 0) + misses);
      });

      // --- 3. 現在データの救出 ---
      // ★重要：タイムアップ瞬間に「今入力中の単語」はまだリストに入っていないため、
      // ここで手動でMapに加算してあげる（最後の1秒のミスも無駄にしない）
      if (currentWordMissRef.current > 0) {
        const currentTotal = weakWordMap.get(jpText) || 0;
        weakWordMap.set(jpText, currentTotal + currentWordMissRef.current);
      }

      // --- 4. 配列化・ソート・フィルタリング ---
      // Mapを配列に戻し、「ミスが多い順」に並び替えて「上位N件」に絞る
      const sortedWeakWordsRecord = Array.from(
        weakWordMap,
        ([word, misses]) => ({ word, misses }),
      )
        .sort((a, b) => b.misses - a.misses)
        .slice(0, LIMIT_DATA.WAKE_DATA_LIMIT);

      // 結果データ作成
      const stats = createGameStats({
        score,
        words: completedWords,
        correct: correctCount,
        miss: missCount,
        backspace: backspaceCount,
        combo: maxCombo,
        speed: Number(currentSpeed),
        rank: rank,
        weakWords: sortedWeakWordsRecord,
        weakKeys: missedCharsRecord,
      });

      setLastGameStats(stats);
      setGameState("finishing");
      setIsFinishExit(false);
      setIsWhiteFade(false);

      // ★ Hookに処理を委譲（ローカル保存計算など）
      processResult(stats);

      setTimeout(() => setIsFinishExit(true), UI_TIMINGS.GAME.FINISH_ANIMATION);
      setTimeout(() => setIsWhiteFade(true), UI_TIMINGS.GAME.WHITE_FADE_OUT);
      setTimeout(() => {
        setGameState("result");
        setIsWhiteFade(false);
        setIsFinishExit(false);
      }, UI_TIMINGS.GAME.GO_TO_RESULT);
    }
  }, [
    timeLeft,
    gameState,
    playPhase,
    score,
    difficulty,
    correctCount,
    missCount,
    backspaceCount,
    maxCombo,
    currentSpeed,
    rank,
    missedWordsRecord,
    missedCharsRecord,
    jpText,
    completedWords,
    processResult, // ← hook関数
  ]);

  // ★ リザルト画面開始（保存 & 演出）
  useEffect(() => {
    if (gameState === "result" && lastGameStats) {
      saveScore(lastGameStats, playerName);
      playResultAnimation(lastGameStats.rank);
    }
  }, [gameState, lastGameStats, saveScore, playResultAnimation, playerName]);

  // ランキング
  const fetchRanking = async (targetDiff?: DifficultyLevel) => {
    playSE("decision");
    const searchDiff = targetDiff || difficulty;
    if (targetDiff) setDifficulty(targetDiff);
    setIsDevRankingMode(false);
    setRankingData([]);
    try {
      const data = await DatabaseService.getRanking(searchDiff);
      setRankingData(data);
      setShowRanking(true);
    } catch (error) {
      console.error("ランキング取得エラー:", error);
    }
  };

  const handleShowDevScore = async () => {
    playSE("decision");
    if (isDevRankingMode) return;
    try {
      const data = await DatabaseService.getDevScore(difficulty);
      setRankingData(data);
      setIsDevRankingMode(true);
    } catch (err) {
      console.error("Dev Score fetch error", err);
    }
  };

  const closeRanking = () => {
    setShowRanking(false);
    playSE("decision");
  };

  // 背景画像
  const getCurrentBgSrc = () => {
    if (gameState === "title") return "/images/title.png";
    if (gameState === "difficulty") {
      if (isTransitioning) return DIFFICULTY_SETTINGS[difficulty].bg;
      return hoverDifficulty
        ? DIFFICULTY_SETTINGS[hoverDifficulty].bg
        : "/images/level.png";
    }
    if (
      gameState === "playing" ||
      gameState === "finishing" ||
      gameState === "result"
    ) {
      return DIFFICULTY_SETTINGS[difficulty].bg;
    }
    return "/images/title.png";
  };

  // Canvasアニメーション
  const animate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const state = animationState.current;

    if (
      canvas &&
      ctx &&
      (gameState === "playing" || gameState === "finishing")
    ) {
      canvas.width = DISPLAY_SCALE.WIDTH;
      canvas.height = DISPLAY_SCALE.HEIGHT;

      if (playPhase === "ready") {
        if (state.isReadyAnimating) {
          state.readyY += READY_GO_ANIMATION.DROP;
          if (state.readyY >= 0) {
            state.readyY = 0;
            state.isReadyAnimating = false;
            state.showEnterSpaceText = true;
          }
        }
        drawReadyAnimation(
          ctx,
          canvas.width,
          canvas.height,
          state.readyY,
          readyImageRef.current,
          state.showEnterSpaceText,
        );
      } else if (playPhase === "go") {
        if (state.goScale < READY_GO_ANIMATION.GO_MAX)
          state.goScale += READY_GO_ANIMATION.GO_HIG;
        drawGoAnimation(ctx, canvas.width, canvas.height, state.goScale);
      } else if (playPhase === "game") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, playPhase]);

  const getInitialAnimationState = () => ({
    readyY: -READY_GO_ANIMATION.INIT,
    isReadyAnimating: true,
    showEnterSpaceText: false,
    showGoText: false,
    goScale: READY_GO_ANIMATION.GO_INIT,
    phase: "ready",
  });

  // ゲーム制御
  const resetToReady = () => {
    playSE("decision");
    stopBGM();
    resetGame();
    // hasSaved等のリセットはHook側でやってくれるなら呼び出す、
    // あるいは単純に画面遷移すればHookがリセットされる設計ならOK
    resetResultState();
    setPlayPhase("ready");
    animationState.current = getInitialAnimationState();
  };

  const backToDifficulty = () => {
    playSE("decision");
    if (gameState !== "hiscore_review") {
      stopBGM();
      startSelectBgm();
    }
    setGameState("difficulty");
    setIsTransitioning(false);
  };

  const retryGame = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    playSE("decision");
    resetGame();
    setIsFinishExit(false);
    setIsWhiteFade(false);
    stopBGM();
    animationState.current = getInitialAnimationState();
    setTimeout(() => {
      setPlayPhase("ready");
      setGameState("playing");
      setIsTransitioning(false);
      setIsInputLocked(false);
    }, 50);
  };

  const goToDifficulty = () => {
    if (isTitleExiting || isInputLocked) return;
    playSE("decision");
    setIsInputLocked(true);
    setIsTitleExiting(true);
    setTimeout(() => {
      startSelectBgm();
      setGameState("difficulty");
      setIsTitleExiting(false);
      setTimeout(() => setIsInputLocked(false), UI_TIMINGS.TITLE.INPUT_LOCK);
    }, UI_TIMINGS.DIFFICULTY.SELECT_START);
  };

  const handleSelectDifficulty = (diff: DifficultyLevel) => {
    if (isTransitioning || isInputLocked) return;
    setIsTransitioning(true);
    setIsInputLocked(true);
    playSE("decision");
    setDifficulty(diff);
    resetGame();
    setIsFinishExit(false);
    setIsWhiteFade(false);
    stopBGM();
    animationState.current = getInitialAnimationState();
    setTimeout(() => {
      setPlayPhase("ready");
      setGameState("playing");
      setIsTransitioning(false);
      setIsInputLocked(false);
    }, 50);
  };

  const backToTitle = () => {
    playSE("decision");
    stopBGM();
    setGameState("title");
    setShowTitle(false);
    setEnableBounce(false);
    setIsTitleExiting(false);
    setIsInputLocked(true);
    setTimeout(() => {
      setShowTitle(true);
      setTimeout(() => {
        setEnableBounce(true);
        setIsInputLocked(false);
      }, UI_TIMINGS.TITLE.BOUNCE_DELAY);
    }, 100);
  };

  // キー監視
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        if (
          [
            "Shift",
            "Alt",
            "Meta",
            "Control",
            "Tab",
            "CapsLock",
            "Insert",
            "Delete",
            "Home",
            "End",
            "PageUp",
            "PageDown",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
          ].includes(e.key) ||
          (e.key.startsWith("F") && e.key.length > 1)
        )
          return;
      }
      if (
        e.isComposing ||
        ["Process", "KanaMode", "Conversion", "NonConvert"].includes(e.code)
      )
        return;

      const state = animationState.current;

      // 3. 【State Machine】ゲームの状態（画面）で分岐
      switch (gameState) {
        case "playing":
          // プレイ画面の中でのさらに細かいフェーズ分岐
          if (playPhase === "ready" && !state.isReadyAnimating) {
            if (e.key === "Enter" || e.key === " ") {
              playSE("start");
              setPlayPhase("go");
              state.goScale = READY_GO_ANIMATION.GO_INIT;
              setTimeout(() => {
                setPlayPhase("game");
                startGame();
                playBGM(DIFFICULTY_SETTINGS[difficulty].bgm);
              }, 1000);
            } else if (e.key === "Escape") {
              backToDifficulty();
            }
            return;
          }

          if (playPhase === "game") {
            if (e.key === "Escape") {
              e.preventDefault();
              resetToReady();
              return;
            }
            if (e.key === "Backspace") {
              e.preventDefault();
              handleBackspaceRef.current();
              return;
            }
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              handleKeyInputRef.current(e.key.toLowerCase());
            }
            return;
          }
          break;

        case "result":
          // リザルト画面の処理
          const currentRank = lastGameStats ? lastGameStats.rank : rank;
          handleResultKeyAction(
            e.key,
            currentRank,
            retryGame,
            backToDifficulty,
          );
          break;

        // 将来的に case "title": や case "difficulty": を追加しやすくなる
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    gameState,
    playPhase,
    startGame,
    difficulty,
    handleStartSequence,
    handleResultKeyAction,
    lastGameStats,
    rank,
  ]);

  // シェア
  const getShareUrl = () => {
    const text = encodeURIComponent(
      `CRITICAL TYPINGでスコア:${score.toLocaleString()} ランク:${rank} を獲得しました！`,
    );
    const hashtags = encodeURIComponent("CRITICALTYPING,タイピング");
    const url = encodeURIComponent(window.location.origin);
    return `https://twitter.com/intent/tweet?text=${text}&hashtags=${hashtags}&url=${url}`;
  };

  // ハイスコア詳細
  const handleShowHighScoreDetail = () => {
    const displayDiff = hoverDifficulty || difficulty;
    const data =
      getSavedHighScoreResult(displayDiff) ??
      createGameStats({
        score: getSavedHighScore(displayDiff),
      });
    setReviewData(data);

    // ★ Hookのスキップ関数でアニメ完了状態にする
    skipAnimation("S", false);
    setGameState("hiscore_review");
  };

  const allBackgrounds = [
    { key: "title", src: "/images/title.png" },
    { key: "level", src: "/images/level.png" },
    ...(["EASY", "NORMAL", "HARD"] as DifficultyLevel[]).map((difficulty) => ({
      key: difficulty,
      src: DIFFICULTY_SETTINGS[difficulty].bg,
    })),
  ];
  const targetBgSrc = getCurrentBgSrc();

  // 表示用データ選択
  const sortedWeakWords = [...missedWordsRecord]
    .sort((a, b) => b.misses - a.misses)
    .slice(0, LIMIT_DATA.WAKE_DATA_LIMIT);

  let displayData: GameResultStats;
  if (gameState === "hiscore_review" && reviewData) {
    displayData = createGameStats(reviewData);
  } else if (gameState === "result" && lastGameStats) {
    displayData = lastGameStats;
  } else {
    displayData = createGameStats({
      score,
      words: completedWords,
      correct: correctCount,
      miss: missCount,
      backspace: backspaceCount,
      speed: Number(currentSpeed),
      combo: maxCombo,
      rank,
      weakWords: sortedWeakWords,
      weakKeys: missedCharsRecord,
    });
  }

  return (
    <div className="App">
      <div id="scaler">
        <div id="game-wrapper">
          {/* 背景 */}
          {allBackgrounds.map((bg) => (
            <div
              key={bg.key}
              className="bg-layer"
              style={{
                backgroundImage: `url(${bg.src})`,
                opacity: targetBgSrc === bg.src ? 1 : 0,
                zIndex: targetBgSrc === bg.src ? 1 : 0,
              }}
            />
          ))}

          {/* 演出オーバーレイ */}
          <div
            id="game-screen"
            className={`${
              isRainbowMode &&
              (gameState === "playing" || gameState === "finishing")
                ? "rainbow-glow"
                : ""
            } ${gameState === "finishing" ? "bg-blur" : ""}`}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 2,
            }}
          ></div>
          <div id="fade-overlay" style={{ opacity: isWhiteFade ? 1 : 0 }}></div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            id="myCanvas"
            className={gameState === "playing" ? "" : "hidden"}
            style={{ zIndex: 15, position: "relative", pointerEvents: "none" }}
          />

          {/* LOADING */}
          {gameState === "loading" && (
            <div id="loading-screen">
              <div className="keyboard-loader">
                {["L", "O", "A", "D", "I", "N", "G"].map((char, i) => (
                  <span key={i} className="key cat">
                    {char}
                  </span>
                ))}
              </div>
              <div className="loading-text">
                <span className="paw">🐾</span> Loading...{" "}
                <span className="paw">🐾</span>
              </div>
            </div>
          )}

          {/* TITLE */}
          {gameState === "title" && (
            <TitleScreen
              showTitle={showTitle}
              enableBounce={enableBounce}
              titlePhase={titlePhase}
              isTitleExiting={isTitleExiting}
              isNameConfirmed={isNameConfirmed}
              playerName={playerName}
              setPlayerName={setPlayerName}
              nameError={nameError}
              setNameError={setNameError}
              handleStartSequence={handleStartSequence}
              handleOpenHowToPlay={handleOpenHowToPlay}
              handleOpenConfig={handleOpenConfig}
              handleCancelInput={handleCancelInput}
              handleNameSubmit={handleNameSubmit}
              handleBackToInput={handleBackToInput}
              handleFinalConfirm={handleFinalConfirm}
            />
          )}

          {/* DIFFICULTY */}
          {gameState === "difficulty" && (
            <DifficultySelectScreen
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              hoverDifficulty={hoverDifficulty}
              setHoverDifficulty={setHoverDifficulty}
              isInputLocked={isInputLocked}
              isTransitioning={isTransitioning}
              handleSelectDifficulty={handleSelectDifficulty}
              backToTitle={backToTitle}
              fetchRanking={fetchRanking}
              handleShowHighScoreDetail={handleShowHighScoreDetail}
              playDecisionSound={() => playSE("decision")}
            />
          )}

          {/* GAME */}
          {(gameState === "playing" || gameState === "finishing") && (
            <GameScreen
              gameState={gameState}
              playPhase={playPhase}
              difficulty={difficulty}
              score={score}
              displayScore={displayScore}
              combo={combo}
              comboClass={comboClass}
              timeLeft={timeLeft}
              isTimeAdded={isTimeAdded}
              gaugeValue={gaugeValue}
              gaugeMax={gaugeMax}
              completedWords={completedWords}
              currentSpeed={currentSpeed}
              jpText={jpText}
              romaState={romaState}
              showRomaji={showRomaji}
              allSegments={allSegments}
              shakeStatus={shakeStatus}
              rank={rank}
              bonusPopups={bonusPopups}
              perfectPopups={perfectPopups}
              scorePopups={scorePopups}
              isRainbowMode={isRainbowMode}
              isFinishExit={isFinishExit}
            />
          )}

          {/* RESULT */}
          {(gameState === "result" || gameState === "hiscore_review") && (
            <ResultScreen
              gameState={gameState}
              difficulty={difficulty}
              resultData={displayData}
              highScore={gameState === "result" ? highScore : undefined }
              scoreDiff={scoreDiff}
              isNewRecord={gameState === "result" ? isNewRecord : false}
              resultAnimStep={resultAnimStep}
              onRetry={retryGame}
              onBackToDifficulty={backToDifficulty}
              onBackToTitle={backToTitle}
              onShowRanking={fetchRanking}
              onTweet={getShareUrl}
              onClickScreen={() => {
                // クリック時もEnterと同じ扱い
                const currentRank = lastGameStats ? lastGameStats.rank : rank;
                handleResultKeyAction(
                  "Enter",
                  currentRank,
                  retryGame,
                  backToDifficulty,
                );
              }}
            />
          )}

          {showRanking && (
            <Ranking
              difficulty={difficulty}
              rankingData={rankingData}
              userId={userId}
              isDevRankingMode={isDevRankingMode}
              onClose={closeRanking}
              onShowDevScore={handleShowDevScore}
              onFetchRanking={fetchRanking}
            />
          )}
        </div>
      </div>

      {showHowToPlay && <HowToPlay onClose={handleCloseHowToPlay} />}

      {showConfig && (
        <Setting
          playerName={playerName}
          isMuted={isMuted}
          bgmVol={bgmVol}
          seVol={seVol}
          showRomaji={showRomaji}
          ngWordsList={ngWordsList}
          setIsMuted={setIsMuted}
          setBgmVol={setBgmVol}
          setSeVol={setSeVol}
          setShowRomaji={setShowRomaji}
          onSaveName={handleSaveName}
          onClose={handleCloseConfig}
        />
      )}
    </div>
  );
}

export default App;
