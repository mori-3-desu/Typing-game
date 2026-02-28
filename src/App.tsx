import { useState, useEffect, useRef } from "react";
import { DatabaseService } from "./services/database";
import "./App.css";

// --- Components ---
import { GameCanvas } from "./components/screens/GameCanvas";
import { LoadingScreen } from "./components/screens/LoadingScreen";
import { TitleScreen } from "./components/screens/TitleScreen";
import { DifficultySelectScreen } from "./components/screens/Difficulty";
import { GameScreen } from "./components/screens/GameScreen";
import { ResultScreen } from "./components/screens/ResultScreen";
import { Ranking } from "./components/modals/Ranking";
import { HowToPlay } from "./components/modals/HowToPlay";
import { Setting } from "./components/modals/Setting";

// --- Utils & Hooks ---
import {
  ALL_BACKGROUNDSDATA,
  DIFFICULTY_SETTINGS,
  PLAYER_NAME_CHARS,
  UI_TIMINGS,
  DISPLAY_SCALE,
  STORAGE_KEYS,
  LIMIT_DATA,
} from "./utils/setting";

// 計算ロジック (分離済み)
import { createGameStats } from "./utils/gameUtils";

// ★ 画面遷移ロジック (今回導入！)
import { useScreenRouter } from "./hooks/useScreenRouter";
import { useGameControl } from "./hooks/useGameControl";
import { useAuth } from "./hooks/useAuth";

import { playSE, startSelectBgm, setVolumes, initAudio } from "./utils/audio";

import { useConfig } from "./hooks/useConfig";
import { useTypingGame } from "./hooks/useTypingGame";
import { useGameResult } from "./hooks/useGameResult";
import { useGameKeyHandler } from "./hooks/useGameKeyHandler";
import { getSavedHighScore, getSavedHighScoreResult } from "./utils/storage";

import {
  type DifficultyLevel,
  type WordDataMap,
  type GameResultStats,
  type GameState,
  type PlayPhase,
  type TitlePhase,
  type RankingScore,
} from "./types";

const preloadImages = () => {
  const images = [
    "/images/title.jpg",
    "/images/level.jpg",
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

  // --- State Definitions ---
  const [nameError, setNameError] = useState("");
  const [gameState, setGameState] = useState<GameState>("loading");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("NORMAL");
  const [playPhase, setPlayPhase] = useState<PlayPhase>("ready");

  const [showConfig, setShowConfig] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const [, setIsLoaded] = useState(false);
  const [hoverDifficulty, setHoverDifficulty] =
    useState<DifficultyLevel | null>(null);

  // --- Hook 1: Game Result (リセット関数を取り出す) ---
  const {
    highScore,
    isNewRecord,
    scoreDiff,
    resultAnimStep,
    saveScore,
    processResult,
    playResultAnimation,
    skipAnimation,
    resetResultState, // ★ Routerに渡すため取得
  } = useGameResult(difficulty);

  // プレイヤー名
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || "";
  });
  const [isNameConfirmed, setIsNameConfirmed] = useState(() => {
    return !!localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
  });

  const [ngWordsList, setNgWordsList] = useState<string[]>([]);
  const [titlePhase, setTitlePhase] = useState<TitlePhase>("normal");

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInputLocked, setIsInputLocked] = useState(true);
  const [showTitle, setShowTitle] = useState(false);
  const [enableBounce, setEnableBounce] = useState(false);
  const [isTitleExiting, setIsTitleExiting] = useState(false);

  const [rankingData, setIsRankingData] = useState<RankingScore[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const [isDevRankingMode, setIsDevRankingMode] = useState(false);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [rankingDataMode, setIsRankingDataMode] = useState<
    "global" | "dev" | null
  >(null);

  const [dbWordData, setDbWordData] = useState<WordDataMap | null>(null);
  const [reviewData, setReviewData] = useState<GameResultStats | null>(null);

  // --- Hook 2: Typing Game (リセット関数を取り出す) ---
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
    currentWordMiss,
    backspaceCount,
    allSegments,
    shakeStatus,
    missedWordsRecord,
    missedCharsRecord,
    isRainbowMode,
    bonusPopups,
    perfectPopups,
    scorePopups,
    timePopups,
    tick,
    currentSpeed,
  } = useTypingGame(difficulty, dbWordData);

  // --- Hook 3: Screen Router (画面遷移ロジックの集約) ---
  // ★ ここで一括呼び出し！
  const {
    currentBgSrc,
    resetToReady,
    backToDifficulty,
    retryGame,
    goToDifficulty,
    handleSelectDifficulty,
    backToTitle,
  } = useScreenRouter({
    gameState,
    difficulty,
    hoverDifficulty,
    isTransitioning,
    isInputLocked,
    isTitleExiting,
    setGameState,
    setPlayPhase,
    setDifficulty,
    setIsTransitioning,
    setIsInputLocked,
    setIsTitleExiting,
    setShowTitle,
    setEnableBounce,
    setTitlePhase,
    resetGame, // Hooksから渡す
    resetResultState, // Hooksから渡す
  });

  const handleKeyInputRef = useRef(handleKeyInput);
  const handleBackspaceRef = useRef(handleBackspace);
  const rankingRequestIdRef = useRef(0);

  const myGameStats = {
    score,
    completedWords,
    correctCount,
    missCount,
    backspaceCount,
    maxCombo,
    currentSpeed,
    rank,
    missedWordsRecord,
    missedCharsRecord,
    jpText,
    currentWordMiss,
  };

  // --- ★ Hook: Game Control (タイマー & 終了ロジック) ---
  const { lastGameStats, isFinishExit, isWhiteFade } = useGameControl({
    gameState,
    playPhase,
    difficulty,
    timeLeft,
    currentStats: myGameStats,
    tick,
    setGameState,
    processResult,
  });

  // --- Hook: Auth(認証)
  const { userId, isLoading, error } = useAuth();

  // --- Effects ---
  useEffect(() => {
    handleKeyInputRef.current = handleKeyInput;
    handleBackspaceRef.current = handleBackspace;
  }, [handleKeyInput, handleBackspace]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { formattedData, ngList } =
          await DatabaseService.fetchAllGameData();
        setDbWordData(formattedData);
        setNgWordsList(ngList);
      } catch (err) {
        console.error("Data fetch error", err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    preloadImages();
    initAudio();
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

  useEffect(() => {
    setVolumes(bgmVol, seVol);
    localStorage.setItem(STORAGE_KEYS.VOLUME_BGM, bgmVol.toString());
    localStorage.setItem(STORAGE_KEYS.VOLUME_SE, seVol.toString());
  }, [bgmVol, seVol]);

  useEffect(() => {
    let interval: number;
    if (gameState === "playing" && playPhase === "game" && timeLeft > 0) {
      interval = window.setInterval(() => {
        tick(UI_TIMINGS.GAME.TIMER_DECREMENT);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [gameState, playPhase, timeLeft, tick]);

  useEffect(() => {
    if (gameState === "result" && lastGameStats) {
      saveScore(lastGameStats, playerName);
      playResultAnimation(lastGameStats.rank);
    }
  }, [gameState, lastGameStats, saveScore, playResultAnimation, playerName]);

  // --- Handlers (View Logic) ---
  const handleStartSequence = () => {
    if (isTitleExiting || isInputLocked) return;
    if (isNameConfirmed) {
      goToDifficulty(); // Routerの関数を使用
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

  const handleOpenConfig = () => {
    playSE("decision");
    setShowConfig(true);
  };

  const handleCloseConfig = () => {
    playSE("decision");
    setShowConfig(false);
  };

  const handleSaveName = async (newName: string) => {
    // userId がない（認証が終わっていない）場合は処理を中断
    if (!userId) {
      console.error("User is not authenticated yet.");
      return;
    }
    const finalName = newName || "Guest";
    setPlayerName(finalName);
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, finalName);
    try {
      await DatabaseService.updateUserName(userId, finalName);
    } catch (err) {
      console.error("Name update error:", err);
    }
  };

  const handleOpenHowToPlay = () => {
    playSE("decision");
    setShowHowToPlay(true);
  };

  const handleCloseHowToPlay = () => {
    playSE("decision");
    setShowHowToPlay(false);
  };

  const getShareUrl = () => {
    const text = encodeURIComponent(
      `CRITICAL TYPINGでスコア:${score.toLocaleString()} ランク:${rank} を獲得しました！`,
    );
    const hashtags = encodeURIComponent("CRITICALTYPING,タイピング");
    const url = encodeURIComponent(window.location.origin);
    return `https://twitter.com/intent/tweet?text=${text}&hashtags=${hashtags}&url=${url}`;
  };

  const handleShowHighScoreDetail = () => {
    const displayDiff = hoverDifficulty || difficulty;
    const data =
      getSavedHighScoreResult(displayDiff) ??
      createGameStats({ score: getSavedHighScore(displayDiff) });
    setReviewData(data);
    skipAnimation("S", false);
    setGameState("hiscore_review");
  };

  // =========================================================================
  // 🏆 全国ランキング取得処理
  // =========================================================================
  const fetchRanking = async (targetDiff?: DifficultyLevel) => {
    playSE("decision");

    // 1. 新しい通信用の整理券を発行（連打や通信遅延による「過去データの追い越し」を防止）
    const requestId = ++rankingRequestIdRef.current;

    const searchDiff = targetDiff || difficulty;
    if (targetDiff) setDifficulty(targetDiff);

    // 2. 【超重要】通信を始める「前」に、画面の状態を強制リセット！
    // ここで一気に State を更新することで、React が「古いデータ」を描画する隙を与えない（チラツキ防止）
    setShowRanking(true);
    setIsRankingLoading(true); // スピナーON
    setIsDevRankingMode(false);
    setIsRankingDataMode(null);
    setIsRankingData([]); // 過去のデータ（開発者スコアなど）を完全に破壊

    try {
      // 3. データベースから全国ランキングを取得
      const data = await DatabaseService.getRanking(searchDiff);

      // 4. 通信が終わった時点で、自分が「最新の整理券」を持っているか確認
      // 違っていれば、それは「古いリクエスト」なので画面に反映せずに捨てる
      if (requestId !== rankingRequestIdRef.current) return;

      // 5. 最新のデータだけを安全にセット
      setIsRankingData(data);
      setIsRankingDataMode("global");
    } catch (error) {
      // エラー時も同様に、古いリクエストのエラーなら無視する
      if (requestId !== rankingRequestIdRef.current) return;
      console.error("Ranking fetch error:", error);
    } finally {
      // 6. 自分が最新のリクエストだった場合のみ、ローディング（スピナー）を終了する
      // （古いリクエストが after 処理で勝手にスピナーを消してしまうのを防ぐ）
      if (requestId === rankingRequestIdRef.current) {
        setIsRankingLoading(false);
      }
    }
  };

  // =========================================================================
  // 👑 開発者（クリエイター）スコア取得処理
  // =========================================================================
  const handleShowDevScore = async () => {
    playSE("decision");

    // 既に開発者モードを表示中、または現在何かのデータを読み込み中ならブロック（連打防止）
    if (isDevRankingMode || isRankingLoading) return;

    // 1. 整理券を発行
    const requestId = ++rankingRequestIdRef.current;

    // 2. 【超重要】全国ランキングのデータを破棄して、画面を完全にリセット
    setIsRankingLoading(true);
    setIsRankingDataMode(null);
    setIsRankingData([]);

    try {
      // 3. データベースから開発者スコアを取得
      const data = await DatabaseService.getDevScore(difficulty);

      // 4. 整理券の確認（過去の通信の追い越し防止）
      if (requestId !== rankingRequestIdRef.current) return;

      // 5. 最新データのみセットし、モードを「開発者」に切り替える
      setIsRankingData(data);
      setIsRankingDataMode("dev");
      setIsDevRankingMode(true);
    } catch (error) {
      if (requestId !== rankingRequestIdRef.current) return;
      console.error("Ranking fetch error:", error);
    } finally {
      // 6. 自分が最新のリクエストだった場合のみローディング終了
      if (requestId === rankingRequestIdRef.current) {
        setIsRankingLoading(false);
      }
    }
  };

  const closeRanking = () => {
    rankingRequestIdRef.current += 1;
    setShowRanking(false);
    setIsRankingLoading(false);
    setIsRankingDataMode(null);
    setIsRankingData([]);
    playSE("decision");
  };

  // リサイズ
  const scalerRef = useRef<HTMLDivElement>(null);

  // アニメーションからResizeObserverに変えてみる
  useEffect(() => {
    const scaler = scalerRef.current;

    if (!scaler) return;

    // スケールの共通関数
    const applyScale = (width: number, height: number) => {
      const scale = Math.min(
        width / DISPLAY_SCALE.WIDTH,
        height / DISPLAY_SCALE.HEIGHT,
      );
      scaler.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };

    // ResizeObserverは対応していないブラウザもあるのでその場合はこちらを使う
    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => {
        applyScale(
          document.documentElement.clientWidth,
          document.documentElement.clientHeight,
        );
      };

      // 初回実行
      handleResize();
      window.addEventListener("resize", handleResize);

      // クリーンアップを実施
      return () => window.removeEventListener("resize", handleResize);
    }

    // 対応してる場合の処理、サイズが変わった時だけ実行
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // inlineSize, blockSizeを安全に取得
        let width: number;
        let height: number;

        if (entry.contentBoxSize && entry.contentBoxSize.length > 0) {
          // contentBoxSize は配列で返ってくる（標準仕様）
          width = entry.contentBoxSize[0].inlineSize;
          height = entry.contentBoxSize[0].blockSize;
        } else {
          // 古いブラウザやポリフィル用のフォールバック
          width = entry.contentRect.width;
          height = entry.contentRect.height;
        }

        applyScale(width, height);
      }
    });

    // 監視対象を指定
    observer.observe(document.documentElement);

    // クリーンアップ
    return () => {
      observer.disconnect();
    };
  }, []);

  // --- Key Handler ---
  useGameKeyHandler({
    gameState,
    playPhase,
    difficulty,
    handleKeyInputRef,
    handleBackspaceRef,
    startGame,
    setPlayPhase,
    backToDifficulty,
    resetToReady,
    retryGame,
    lastGameStats,
    rank,
    resultAnimStep,
    skipAnimation,
  });

  const targetBgSrc = currentBgSrc;

  // 表示用データ作成
  const sortedWeakWords = [...missedWordsRecord]
    .sort((a, b) => b.misses - a.misses)
    .slice(0, LIMIT_DATA.WEAK_DATA_LIMIT);
  let displayData: GameResultStats;
  if (gameState === "hiscore_review" && reviewData)
    displayData = createGameStats(reviewData);
  else if (gameState === "result" && lastGameStats) displayData = lastGameStats;
  else
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

  return (
    <div className="App">
      <div id="scaler" ref={scalerRef}>
        {isLoading ? (
          <LoadingScreen />
        ) : error ? (
          <div className="error-fallback">
            Error: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : (
          <div id="game-wrapper">
            {ALL_BACKGROUNDSDATA.map((bg) => (
              <div
                key={bg.key}
                className="bg-layer"
                style={{
                  backgroundImage: `url(${bg.src})`,
                  opacity: targetBgSrc === bg.src ? 1 : 0,
                }}
              />
            ))}
            <div
              id="game-screen"
              className={`${isRainbowMode && (gameState === "playing" || gameState === "finishing") ? "rainbow-glow" : ""} ${gameState === "finishing" ? "bg-blur" : ""}`}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 2,
              }}
            ></div>
            <div
              id="fade-overlay"
              style={{ opacity: isWhiteFade ? 1 : 0 }}
            ></div>

            <GameCanvas gameState={gameState} playPhase={playPhase} />

            {gameState === "loading" && <LoadingScreen />}

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
                timePopups={timePopups}
                isRainbowMode={isRainbowMode}
                isFinishExit={isFinishExit}
              />
            )}

            {(gameState === "result" || gameState === "hiscore_review") && (
              <ResultScreen
                gameState={gameState}
                difficulty={difficulty}
                resultData={displayData}
                highScore={gameState === "result" ? highScore : undefined}
                scoreDiff={scoreDiff}
                isNewRecord={gameState === "result" ? isNewRecord : false}
                resultAnimStep={resultAnimStep}
                onRetry={retryGame}
                onBackToDifficulty={backToDifficulty}
                onBackToTitle={backToTitle}
                onShowRanking={fetchRanking}
                onTweet={getShareUrl}
                onClickScreen={() => {
                  if (gameState === "hiscore_review") {
                    backToDifficulty();
                  } else {
                    skipAnimation(displayData.rank);
                  }
                }}
              />
            )}

            {showRanking && (
              <Ranking
                difficulty={difficulty}
                rankingData={rankingData}
                userId={userId}
                isDevRankingMode={isDevRankingMode}
                rankingDataMode={rankingDataMode}
                isLoading={isRankingLoading}
                onClose={closeRanking}
                onShowDevScore={handleShowDevScore}
                onFetchRanking={fetchRanking}
              />
            )}
          </div>
        )}
        ;{showHowToPlay && <HowToPlay onClose={handleCloseHowToPlay} />}
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
    </div>
  );
}

export default App;
