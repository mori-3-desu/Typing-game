// src/App.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import "./App.css";

// --- Components ---
import { TitleScreen } from "./components/screens/TitleScreen";
import { DifficultySelectScreen } from "./components/screens/Difficulty";
import { GameScreen } from "./components/screens/GameScreen";
import { ResultScreen } from "./components/screens/ResultScreen";

// ▼▼▼ 修正: 正しいファイル名とコンポーネント名でインポート ▼▼▼
import { Ranking } from "./components/modals/Ranking";
import { HowToPlay } from "./components/modals/HowToPlay";
import { Setting } from "./components/modals/Setting";
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

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
import {
  initAudio,
  playDecisionSound,
  startSelectBgm,
  stopSelectBgm,
  playGameBGM,
  stopGameBGM,
  playStartSound,
  playFinishSound,
  playResultSound,
  playRankSSound,
  playRankASound,
  playRankBSound,
  playRankCSound,
  playRankDSound,
} from "./utils/audio";
import { setVolumes } from "./utils/audio";
import { useConfig } from "./hooks/useConfig";
import { drawReadyAnimation, drawGoAnimation } from "./utils/transitions";
import { useTypingGame } from "./hooks/useTypingGame";
import {
  type DifficultyLevel,
  type WordDataMap,
  type GameResultStats,
  type RankingScore,
  type WordRow,
  type TitlePhase,
} from "./types";

// ゲーム始まる前に取得
const preloadImages = () => {
  const images = [
    "/images/title.png",
    "/images/level.png",
    "/images/cloud.png",
    "/images/Ready.jpg",
    "/images/icon_x.jpg",
    "/images/ranking.png",
    "/images/X.jpg",
    ...Object.values(DIFFICULTY_SETTINGS).map((s) => s.bg),
  ];
  images.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};

// スコア数値のみ取得（後方互換）
const getSavedHighScore = (level: DifficultyLevel): number => {
  const key = `${STORAGE_KEYS.HISCORE_REGISTER}${level.toLowerCase()}`;
  const saved = localStorage.getItem(key);
  return saved ? parseInt(saved, 10) : 0; // 10進数で保存
};

// 詳細データも取得
const getSavedHighScoreResult = (level: DifficultyLevel) => {
  const key = `${STORAGE_KEYS.HISCORE_DATA_REGISTER}_${level.toLowerCase()}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved) as GameResultStats; // 元のオブジェクトに変換
    } catch (e) {
      console.error("Save data parse error", e);
      return null;
    }
  }
  return null;
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

  // ★名前: nameError は TitleScreen でも使うので残します
  const [nameError, setNameError] = useState("");

  const [gameState, setGameState] = useState<GameState>("loading");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("NORMAL");
  const [playPhase, setPlayPhase] = useState<PlayPhase>("ready");

  const [, setIsLoaded] = useState(false);
  const [hoverDifficulty, setHoverDifficulty] =
    useState<DifficultyLevel | null>(null);
  const [isWhiteFade, setIsWhiteFade] = useState(false);

  // プレイヤー名（保存されたものを読み込む）
  const [playerName, setPlayerName] = useState(() => {
    const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
    return savedName || "";
  });

  // 名前決定済みフラグ（保存されていれば true）
  const [isNameConfirmed, setIsNameConfirmed] = useState(() => {
    const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
    return !!savedName;
  });

  const [ngWordsList, setNgWordsList] = useState<string[]>([]);

  const [titlePhase, setTitlePhase] = useState<TitlePhase>("normal");

  // 1. setUserId を使えるようにして、初期値を空文字にします
  const [userId, setUserId] = useState("");

  // 2. アプリ起動時に「Supabaseから正式なID」をもらう処理を追加
  useEffect(() => {
    const initAuth = async () => {
      // (A) すでにログイン状態が残っているか確認（リロード時など）
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setUserId(session.user.id);
      } else {
        // (B) ログインしていなければ、匿名ログインを実行！
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
  const [isInputLocked, setIsInputLocked] = useState(true); // 入力ロック

  const [showTitle, setShowTitle] = useState(false);
  const [enableBounce, setEnableBounce] = useState(false);
  const [isTitleExiting, setIsTitleExiting] = useState(false);

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  // ランキング機能
  const [rankingData, setRankingData] = useState<RankingScore[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const [isDevRankingMode, setIsDevRankingMode] = useState(false);

  // 単語データ
  const [dbWordData, setDbWordData] = useState<WordDataMap | null>(null);

  // リザルト・スコア関連
  const [highScore, setHighScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [scoreDiff, setScoreDiff] = useState(0);

  // 閲覧モード用の詳細データ保持
  const [reviewData, setReviewData] = useState<GameResultStats | null>(null);

  // 直前のゲーム結果を固定保持するためのステート
  const [lastGameStats, setLastGameStats] = useState<GameResultStats | null>(
    null,
  );

  const [resultAnimStep, setResultAnimStep] = useState(0);
  const resultTimersRef = useRef<number[]>([]);
  const hasSaved = useRef(false);

  const [isFinishExit, setIsFinishExit] = useState(false);

  // useTypingGame
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
    setElapsedTime,
    currentSpeed,
    setTimeLeft,
  } = useTypingGame(difficulty, dbWordData);

  // 現在入力中の単語のミス数を追跡
  const currentWordMissRef = useRef(0);
  const prevMissCountRef = useRef(0);
  const prevWordRef = useRef("");

  // 単語ごとの独立したミスカウント
  useEffect(() => {
    if (jpText !== prevWordRef.current) {
      currentWordMissRef.current = 0;
      prevWordRef.current = jpText; // 今の単語を記録更新
    }

    if (missCount > prevMissCountRef.current) {
      currentWordMissRef.current += missCount - prevMissCountRef.current;
    }

    prevMissCountRef.current = missCount; // 現在の総ミス数をカウント
  }, [missCount, jpText]);

  // アプリ起動時に Supabase から単語リストとNGワードを取得
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // ゲーム用単語データの取得 (wordsテーブル)
        const { data: wordsData, error: wordsError } = await supabase
          .from("words")
          .select("jp, roma, difficulty");

        if (wordsError) throw wordsError;

        if (wordsData) {
          const formattedData: WordDataMap = {
            EASY: [],
            NORMAL: [],
            HARD: [],
          };

          wordsData.forEach((row: WordRow) => {
            const level = row.difficulty as DifficultyLevel;
            if (formattedData[level]) {
              formattedData[row.difficulty].push({
                jp: row.jp,
                roma: row.roma,
              });
            }
          });

          setDbWordData(formattedData);
        }

        // NGワードの取得 (ng_wordsテーブル)
        const { data: ngData, error: ngError } = await supabase
          .from("ng_words")
          .select("word"); // 'word'カラムだけ取得

        if (ngError) throw ngError;

        if (ngData) {
          const list = ngData.map((item: { word: string }) => item.word);
          setNgWordsList(list); // Stateに保存
        }
      } catch (err) {
        console.error("データ取得に失敗:", err);
      }
    };
    fetchAllData();
  }, []);

  // --- Modal Handlers ---
  const [showConfig, setShowConfig] = useState(false);

  const handleOpenConfig = () => {
    playDecisionSound();
    setShowConfig(true);
  };

  const handleCloseConfig = () => {
    playDecisionSound();
    setShowConfig(false);
  };

  // ConfigModalに渡す、名前保存処理だけをここに残す
  const handleSaveName = async (newName: string) => {
    const finalName = newName || "Guest";
    setPlayerName(finalName);
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, finalName);

    // DB更新
    try {
      const { error } = await supabase
        .from("scores")
        .update({ name: newName })
        .eq("user_id", userId);

      if (error) throw error;
    } catch (err) {
      console.error("名前更新エラー:", err);
    }
  };

  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const handleOpenHowToPlay = () => {
    playDecisionSound();
    setShowHowToPlay(true);
  };

  const handleCloseHowToPlay = () => {
    playDecisionSound();
    setShowHowToPlay(false);
  };

  // ... (Ref更新、アニメーション、タイマー、キー操作などは変更なし) ...
  const handleKeyInputRef = useRef(handleKeyInput);
  const handleBackspaceRef = useRef(handleBackspace);

  useEffect(() => {
    handleKeyInputRef.current = handleKeyInput;
    handleBackspaceRef.current = handleBackspace;
  }, [handleKeyInput, handleBackspace]);

  const canvasRef = useRef<HTMLCanvasElement>(null); // キャンバス要素へのアクセス権
  const requestRef = useRef<number>(0); // アニメーションの予約番号(キャンセル用)
  const readyImageRef = useRef<HTMLImageElement | null>(null); // 画像データの保持

  const animationState = useRef({
    readyY: -READY_GO_ANIMATION.INIT,
    isReadyAnimating: false,
    showEnterText: false,
    showGoText: false,
    goScale: READY_GO_ANIMATION.GO_INIT,
    phase: "idle",
  });

  useEffect(() => {
    preloadImages();
    initAudio();
    const img = new Image();
    img.src = "/images/Ready.jpg";
    img.onload = () => {
      readyImageRef.current = img;
    };

    // 開始時刻を記録
    const startTime = Date.now();

    const checkLoad = setInterval(() => {
      // 経過時間を計算
      const elapsedTime = Date.now() - startTime;
      if (dbWordData && elapsedTime > UI_TIMINGS.MIN_LOADING_TIME) {
        clearInterval(checkLoad);
        setIsLoaded(true);
        setGameState("title");

        setTimeout(() => {
          setShowTitle(true);
          setTimeout(() => {
            setEnableBounce(true);
            setIsInputLocked(false); // 入力許可
          }, UI_TIMINGS.TITLE.BOUNCE_DELAY);
        }, UI_TIMINGS.TITLE.SHOW_DELAY);
      }
    }, 100);

    return () => clearInterval(checkLoad);
  }, [dbWordData]);

  useEffect(() => {
    setVolumes(bgmVol, seVol);
    localStorage.setItem(STORAGE_KEYS.VOLUME_BGM, bgmVol.toString());
    localStorage.setItem(STORAGE_KEYS.VOLUME_SE, seVol.toString());
  }, [bgmVol, seVol]);

  // タイトル画面で入力フォームを開く処理
  const handleStartSequence = () => {
    if (isTitleExiting || isInputLocked) return;

    if (isNameConfirmed) {
      // 既に登録済みなら難易度選択画面へ
      goToDifficulty();
      return;
    }

    playDecisionSound();
    setIsInputLocked(true);
    setIsTitleExiting(true);

    setTimeout(() => {
      setIsTitleExiting(false);
      setIsInputLocked(false);
      setNameError(""); // エラーリセット
      setTitlePhase("input");
    }, UI_TIMINGS.TITLE.BUTTON_FADE_OUT);
  };

  // タイトル画面：入力キャンセル（タイトルロゴへ戻る）
  const handleCancelInput = () => {
    playDecisionSound();
    setTitlePhase("normal");
  };

  // タイトル画面：名前決定処理
  const handleNameSubmit = () => {
    const trimmedName = playerName.trim();

    setNameError(""); // エラーリセット

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

    // 入力が空なら"Guest"に、文字があればそれをセット
    setPlayerName(trimmedName || "Guest");
    playDecisionSound();
    setTitlePhase("confirm");
  };

  const handleFinalConfirm = () => {
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, playerName);
    playDecisionSound();
    startSelectBgm();
    setIsNameConfirmed(true);
    setGameState("difficulty");
    setTitlePhase("normal");
  };

  const handleBackToInput = () => {
    playDecisionSound();
    setTitlePhase("input");
  };

  // スケール調整
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

  useEffect(() => {
    let interval: number;
    if (gameState === "playing" && playPhase === "game" && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev) =>
          Math.max(0, prev - UI_TIMINGS.GAME.TIMER_DECREMENT),
        );
        setElapsedTime((prev) => prev + UI_TIMINGS.GAME.TIMER_DECREMENT);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [gameState, playPhase, timeLeft, setTimeLeft, setElapsedTime]);

  useEffect(() => {
    if (gameState === "playing" && playPhase === "game" && timeLeft <= 0) {
      stopGameBGM();
      playFinishSound();

      let finalWeakWords = [...missedWordsRecord];
      if (currentWordMissRef.current > 0) {
        const existing = finalWeakWords.find((w) => w.word === jpText);
        if (existing) {
          existing.misses += currentWordMissRef.current;
        } else {
          finalWeakWords.push({
            word: jpText,
            misses: currentWordMissRef.current,
          });
        }
      }

      const sortedWeakWordsRecord = finalWeakWords
        .sort((a, b) => b.misses - a.misses)
        .slice(0, LIMIT_DATA.WAKE_DATA_LIMIT);

      // 別枠で終了時のデータを保存
      setLastGameStats({
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

      setGameState("finishing");

      setIsFinishExit(false);
      setIsWhiteFade(false);

      const currentSaved = getSavedHighScore(difficulty);
      if (score > currentSaved) {
        setIsNewRecord(true);
      } else {
        setIsNewRecord(false);
      }

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
    highScore,
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
  ]);

  const saveScore = useCallback(async () => {
    if (saveStatus === "saving" || saveStatus === "success") return;

    const targetStats = lastGameStats || {
      score,
      words: completedWords,
      correct: correctCount,
      miss: missCount,
      backspace: backspaceCount,
      combo: maxCombo,
      speed: Number(currentSpeed),
    };

    if (targetStats.score <= 0) {
      setSaveStatus("success");
      return;
    }

    setSaveStatus("saving");

    try {
      // 1. まずサーバー上の最新スコアを確認（低い点数で上書きしないため）
      const { data: existingData, error: fetchError } = await supabase
        .from("scores")
        .select("score") // スコアだけ分かればOK
        .eq("user_id", userId)
        .eq("difficulty", difficulty)
        .maybeSingle();

      // エラーが「データなし」以外の場合は中断
      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      // 2. 既に高いスコアがサーバーにある場合は、保存せずに終了
      if (existingData && targetStats.score <= existingData.score) {
        console.log("ハイスコアではないため保存しません");
        setSaveStatus("success");
        return;
      }

      // 3. upsertを実行（これ1つで 新規登録 or 上書き を自動判断！）
      const { error: upsertError } = await supabase.from("scores").upsert(
        {
          user_id: userId,
          difficulty: difficulty,
          name: playerName, // 名前も常に最新に更新
          score: targetStats.score,
          correct: targetStats.correct,
          miss: targetStats.miss,
          backspace: targetStats.backspace,
          combo: targetStats.combo,
          speed: targetStats.speed,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id, difficulty" }, // この組み合わせが被ったら上書きせよ、という合図
      );

      if (upsertError) throw upsertError;

      setSaveStatus("success");
    } catch (error) {
      const err = error as { message: string };
      console.error("❌ 保存エラー:", err.message);
      setSaveStatus("error");
    }
  }, [
    difficulty,
    lastGameStats,
    score,
    correctCount,
    missCount,
    backspaceCount,
    maxCombo,
    currentSpeed,
    saveStatus,
    playerName,
    userId,
  ]);

  // 全国ランキング取得
  const fetchRanking = async (targetDiff?: DifficultyLevel) => {
    playDecisionSound();
    const searchDiff = targetDiff || difficulty;

    if (targetDiff) {
      setDifficulty(targetDiff);
    }

    setIsDevRankingMode(false);
    setRankingData([]);

    const { data, error } = await supabase
      .from("scores")
      .select("*")
      .eq("difficulty", searchDiff)
      .eq("is_creator", false) // 作成者フラグが「OFF」の人だけ集める
      .order("score", { ascending: false })
      .limit(LIMIT_DATA.RANKING_LIMIT);

    if (error) {
      console.error("ランキング取得エラー:", error);
    } else {
      setRankingData(data || []);
      setShowRanking(true);
    }
  };

  // 作成者のスコア
  const handleShowDevScore = async () => {
    playDecisionSound();
    if (isDevRankingMode) return;

    try {
      const { data, error } = await supabase
        .from("scores")
        .select("*")
        .eq("difficulty", difficulty)
        .eq("is_creator", true)
        .order("score", { ascending: false })
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
    if (gameState === "result") {
      // ここでデータを保存
      if (!hasSaved.current) {
        saveScore();
        hasSaved.current = true;
      }

      const storageKey = `${
        STORAGE_KEYS.HISCORE_REGISTER
      }${difficulty.toLowerCase()}`;
      const dataKey = `${
        STORAGE_KEYS.HISCORE_DATA_REGISTER
      }_${difficulty.toLowerCase()}`;

      // 終わった地点のデータを取得
      const currentStats = lastGameStats || {
        score,
        words: completedWords,
        correct: correctCount,
        miss: missCount,
        backspace: backspaceCount,
        combo: maxCombo,
        speed: Number(currentSpeed), // speedは数字にしておく
        rank,
        weakWords: missedWordsRecord,
        weakKeys: missedCharsRecord,
      };

      const savedScore = parseInt(localStorage.getItem(storageKey) || "0", 10); // データがない場合は0を使う、10進数で読み込む

      // 先に差分を計算する（プラスになるかマイナスになるかは結果次第）
      const diff = currentStats.score - savedScore;
      setScoreDiff(diff); // Stateにも入れる

      if (currentStats.score > savedScore) {
        // 更新した場合
        setIsNewRecord(true);
        setHighScore(currentStats.score);

        // 保存処理
        localStorage.setItem(storageKey, currentStats.score.toString());

        // 詳細データ保存
        const highScoreData = { ...currentStats };
        // ローカルストレージは文字しか入れられないから文字にしてから保存する
        localStorage.setItem(dataKey, JSON.stringify(highScoreData));
      } else {
        // 更新ならず
        setIsNewRecord(false);
        setHighScore(savedScore);
      }

      setResultAnimStep(0); // リザルト演出効果音
      resultTimersRef.current = [];

      const schedule = [
        { step: 1, delay: UI_TIMINGS.RESULT.STEP_1, sound: playResultSound },
        { step: 2, delay: UI_TIMINGS.RESULT.STEP_2, sound: playResultSound },
        { step: 3, delay: UI_TIMINGS.RESULT.STEP_3, sound: playResultSound },
        {
          step: 4,
          delay: UI_TIMINGS.RESULT.STEP_4,
          sound: () => {
            // ランクによって変動
            if (currentStats.rank === "S") playRankSSound();
            else if (currentStats.rank === "A") playRankASound();
            else if (currentStats.rank === "B") playRankBSound();
            else if (currentStats.rank === "C") playRankCSound();
            else playRankDSound();
          },
        },
        { step: 5, delay: UI_TIMINGS.RESULT.STEP_5, sound: null },
      ];

      schedule.forEach(({ step, delay, sound }) => {
        const timer = window.setTimeout(() => {
          setResultAnimStep(step);
          if (sound) sound();
        }, delay);
        resultTimersRef.current.push(timer);
      });

      return () => {
        resultTimersRef.current.forEach(clearTimeout); // 再生したら、順番に停止していく
      };
    }
  }, [
    gameState,
    score,
    difficulty,
    rank,
    correctCount,
    missCount,
    backspaceCount,
    maxCombo,
    currentSpeed,
    missedWordsRecord,
    missedCharsRecord,
    lastGameStats,
  ]);

  useEffect(() => {
    const savedScore = getSavedHighScore(difficulty);
    setHighScore(savedScore);
  }, [difficulty]);

  // クリックしたらランク演出まで飛ばす
  const handleResultClick = () => {
    if (gameState === "result" && resultAnimStep < 5) {
      resultTimersRef.current.forEach(clearTimeout);
      resultTimersRef.current = [];

      setResultAnimStep(5);

      const targetRank = lastGameStats ? lastGameStats.rank : rank;

      if (targetRank === "S") playRankSSound();
      else if (targetRank === "A") playRankASound();
      else if (targetRank === "B") playRankBSound();
      else if (targetRank === "C") playRankCSound();
      else playRankDSound();
    }
  };

  // 難易度選択ホバー時の画像取得処理
  const getCurrentBgSrc = () => {
    if (gameState === "title") return "/images/title.png";
    if (gameState === "difficulty") {
      if (isTransitioning) return DIFFICULTY_SETTINGS[difficulty].bg; // カーソルを難易度に合わせたら難易度画像を取得
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

      // ready降下(まぁ別に降下しなくていいかも)
      if (playPhase === "ready") {
        if (state.isReadyAnimating) {
          state.readyY += READY_GO_ANIMATION.DROP;
          if (state.readyY >= 0) {
            state.readyY = 0;
            state.isReadyAnimating = false;
            state.showEnterText = true;
          }
        }
        drawReadyAnimation(
          ctx,
          canvas.width,
          canvas.height,
          state.readyY,
          readyImageRef.current,
          state.showEnterText,
        );
      } else if (playPhase === "go") {
        if (hasSaved.current !== false) {
          hasSaved.current = false;
        }

        if (state.goScale < READY_GO_ANIMATION.GO_MAX)
          state.goScale += READY_GO_ANIMATION.GO_HIG;
        drawGoAnimation(ctx, canvas.width, canvas.height, state.goScale);
      } else if (playPhase === "game") {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // まっさらにする(これがないと残像になり、残る)
      }
    }
    requestRef.current = requestAnimationFrame(animate); // CanvasAPI 一コマずつ動かす
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, playPhase]);

  // ゲーム中のリセット処理
  const resetToReady = () => {
    playDecisionSound();
    stopGameBGM();
    resetGame();
    hasSaved.current = false;
    setSaveStatus("idle");
    setPlayPhase("ready");
    animationState.current = {
      readyY: -READY_GO_ANIMATION.INIT,
      isReadyAnimating: true,
      showEnterText: false,
      showGoText: false,
      goScale: READY_GO_ANIMATION.GO_INIT,
      phase: "ready",
    };
  };

  // 難易度選択に戻る
  const backToDifficulty = () => {
    playDecisionSound();

    if (gameState !== "hiscore_review") {
      stopGameBGM();
      startSelectBgm();
    }

    setGameState("difficulty");
    setIsTransitioning(false);
  };

  //もう一度を選択
  const retryGame = () => {
    if (isTransitioning) return;
    setSaveStatus("idle");
    setIsTransitioning(true);
    playDecisionSound();
    resetGame();
    setIsFinishExit(false);
    setIsWhiteFade(false);
    setTimeLeft(DIFFICULTY_SETTINGS[difficulty].time);
    stopSelectBgm();
    animationState.current = {
      readyY: -READY_GO_ANIMATION.INIT,
      isReadyAnimating: true,
      showEnterText: false,
      showGoText: false,
      goScale: READY_GO_ANIMATION.GO_INIT,
      phase: "ready",
    };
    setTimeout(() => {
      setPlayPhase("ready");
      setGameState("playing");
      setIsTransitioning(false);
      setIsInputLocked(false);
      hasSaved.current = false;
    }, 50);
  };

  // リザルト画面キー操作でも〇
  const handleResultKeyAction = (key: string) => {
    if (key === "Enter") {
      if (resultAnimStep < 5) handleResultClick();
      else retryGame();
    } else if (key === "Escape") {
      if (resultAnimStep < 5) handleResultClick();
      else backToDifficulty();
    }
  };

  // 名前を入力してたら難易度選択へ
  const goToDifficulty = () => {
    if (isTitleExiting || isInputLocked) return;

    playDecisionSound();
    setIsInputLocked(true);
    setIsTitleExiting(true);

    setTimeout(() => {
      startSelectBgm();
      setGameState("difficulty");
      setIsTitleExiting(false);
      setTimeout(() => setIsInputLocked(false), UI_TIMINGS.TITLE.INPUT_LOCK);
    }, UI_TIMINGS.DIFFICULTY.SELECT_START);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        // 特殊キー無効化
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

      // 日本語入力(IME)関連の誤動作防止
      if (
        e.isComposing ||
        ["Process", "KanaMode", "Conversion", "NonConvert"].includes(e.code)
      )
        return;

      const state = animationState.current;

      // Ready?画面時
      if (
        gameState === "playing" &&
        playPhase === "ready" &&
        !state.isReadyAnimating
      ) {
        if (e.key === "Enter") {
          playStartSound();
          setPlayPhase("go");
          state.goScale = READY_GO_ANIMATION.GO_INIT;
          setTimeout(() => {
            setPlayPhase("game");
            startGame();
            playGameBGM(DIFFICULTY_SETTINGS[difficulty].bgm);
          }, 1000);
        } else if (e.key === "Escape") {
          backToDifficulty();
        }
      } else if (gameState === "playing" && playPhase === "game") {
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
      } else if (gameState === "result") {
        handleResultKeyAction(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    gameState,
    playPhase,
    startGame,
    difficulty,
    resultAnimStep,
    handleStartSequence,
  ]);

  // 難易度を選択した時の処理
  const handleSelectDifficulty = (diff: DifficultyLevel) => {
    if (isTransitioning || isInputLocked) return;

    setIsTransitioning(true);
    setIsInputLocked(true);

    playDecisionSound();
    setDifficulty(diff);
    resetGame();
    setSaveStatus("idle");
    setIsFinishExit(false);
    setIsWhiteFade(false);

    setTimeLeft(DIFFICULTY_SETTINGS[diff].time);
    stopSelectBgm();
    animationState.current = {
      readyY: -READY_GO_ANIMATION.INIT,
      isReadyAnimating: true,
      showEnterText: false,
      showGoText: false,
      goScale: READY_GO_ANIMATION.GO_INIT,
      phase: "ready",
    };

    setTimeout(() => {
      setPlayPhase("ready");
      setGameState("playing");
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
    setSaveStatus("idle");

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

  //シェア機能
  const getShareUrl = () => {
    const text = encodeURIComponent(
      `CRITICAL TYPINGでスコア:${score.toLocaleString()} ランク:${rank} を獲得しました！`,
    );
    const hashtags = encodeURIComponent("CRITICALTYPING,タイピング");
    const url = encodeURIComponent(window.location.origin);
    return `https://twitter.com/intent/tweet?text=${text}&hashtags=${hashtags}&url=${url}`;
  };

  // ハイスコア時のリザルトを難易度選択でも見れるように
  const handleShowHighScoreDetail = () => {
    const displayDiff = hoverDifficulty || difficulty;
    const data = getSavedHighScoreResult(displayDiff);

    if (data) {
      setReviewData(data);
    } else {
      const savedScore = getSavedHighScore(displayDiff);
      setReviewData({
        score: savedScore,
        correct: 0,
        words: 0,
        miss: 0,
        backspace: 0,
        speed: 0,
        combo: 0,
        rank: "-",
        weakWords: [],
        weakKeys: {},
      });
    }

    setResultAnimStep(5);
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

  // ★重要：ここで「リザルト画面に渡すデータ」を1つに絞ります！
  // 苦手単語リスト計算
  const sortedWeakWords = [...missedWordsRecord]
    .sort((a, b) => b.misses - a.misses)
    .slice(0, LIMIT_DATA.WAKE_DATA_LIMIT);

  let displayData: GameResultStats;
  if (gameState === "hiscore_review" && reviewData) {
    displayData = {
      ...reviewData,
      words: reviewData.words || 0,
      weakWords: reviewData.weakWords || [],
      weakKeys: reviewData.weakKeys || {},
    };
  } else if (gameState === "result" && lastGameStats) {
    displayData = lastGameStats;
  } else {
    displayData = {
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
    };
  }

  return (
    <div className="App">
      {/* ゲーム本体（スケーリングされる部分） */}
      <div id="scaler">
        <div id="game-wrapper">
          {/* 背景レイヤー */}
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

          {/* 演出用スクリーン & フェード */}
          <div
            id="game-screen"
            className={`${isRainbowMode ? "rainbow-glow" : ""} ${
              gameState === "finishing" ? "bg-blur" : ""
            }`}
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
            style={{
              zIndex: 15,
              position: "relative",
              pointerEvents: "none",
            }}
          />

          {/* LOADING SCREEN */}
          {gameState === "loading" && (
            <div id="loading-screen">
              <div className="keyboard-loader">
                <span className="key cat">L</span>
                <span className="key cat">O</span>
                <span className="key cat">A</span>
                <span className="key cat">D</span>
                <span className="key cat">I</span>
                <span className="key cat">N</span>
                <span className="key cat">G</span>
              </div>
              <div className="loading-text">
                <span className="paw">🐾</span> Loading...{" "}
                <span className="paw">🐾</span>
              </div>
            </div>
          )}

          {/* TITLE SCREEN */}
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

          {/* DIFFICULTY SCREEN */}
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
              playDecisionSound={playDecisionSound}
            />
          )}

          {/* GAME HUD (プレイ画面) */}
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

          {/* RESULT SCREEN (結果画面) */}
          {(gameState === "result" || gameState === "hiscore_review") && (
            <ResultScreen
              gameState={gameState}
              difficulty={difficulty}
              resultData={displayData}
              highScore={highScore}
              scoreDiff={scoreDiff}
              isNewRecord={isNewRecord}
              resultAnimStep={resultAnimStep}
              onRetry={retryGame}
              onBackToDifficulty={backToDifficulty}
              onBackToTitle={backToTitle}
              onShowRanking={fetchRanking}
              onTweet={getShareUrl}
              onClickScreen={handleResultClick}
            />
          )}
        </div>
      </div>

      {/* ▼▼▼ 修正: モーダルたちを scaler の外に出しました！ ▼▼▼ */}
      {/* これで画面サイズやズームに関係なく、常に画面中央に正しく表示されます */}

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
          playDecisionSound={playDecisionSound}
        />
      )}
    </div>
  );
}

export default App;
