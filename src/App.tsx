import { useState, useEffect, useRef } from "react";
import { DatabaseService } from "./services/database";
import "./App.css";

// --- Components ---
import { GameCanvas } from "./components/screens/GameCanvas";
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
  type RankingScore,
  type GameState,
  type PlayPhase,
  type TitlePhase,
} from "./types";

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

  const [rankingData, setRankingData] = useState<RankingScore[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const [isDevRankingMode, setIsDevRankingMode] = useState(false);

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

  // --- Hook 3: Screen Router (画面遷移ロジックの集約) ---
  // ★ ここで一括呼び出し！
  const {
    getCurrentBgSrc,
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

  // --- Refs ---
  const currentWordMissRef = useRef(0);
  const prevMissCountRef = useRef(0);
  const prevWordRef = useRef("");
  const handleKeyInputRef = useRef(handleKeyInput);
  const handleBackspaceRef = useRef(handleBackspace);

  // --- ★ Hook: Game Control (タイマー & 終了ロジック) ---
  const { lastGameStats, isFinishExit, isWhiteFade } = useGameControl({
    gameState,
    playPhase,
    difficulty,
    timeLeft,
    tick,
    setGameState,
    processResult,
    // 統計データ (typingGame から取得したもの)
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
    currentWordMiss: currentWordMissRef.current,
  });

  // --- Hook: Auth(認証)
  const { userId } = useAuth();

  // --- Effects ---
  useEffect(() => {
    handleKeyInputRef.current = handleKeyInput;
    handleBackspaceRef.current = handleBackspace;
  }, [handleKeyInput, handleBackspace]);

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
      console.error("Ranking fetch error:", error);
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
      console.error("Dev Score error", err);
    }
  };

  const closeRanking = () => {
    setShowRanking(false);
    playSE("decision");
  };

  // リサイズ
  const scalerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;

    const handleResize = () => {
      // 描画タイミングに合わせて実行（二重実行を防止）
      if (animationFrameId) return;

      animationFrameId = window.requestAnimationFrame(() => {
        const scaler = scalerRef.current;
        if (scaler) {
          const scale = Math.min(
            window.innerWidth / DISPLAY_SCALE.WIDTH,
            window.innerHeight / DISPLAY_SCALE.HEIGHT,
          );
          scaler.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
        animationFrameId = 0; // リセット
      });
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // 初回実行

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
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

  // --- Render Helpers ---
  const allBackgrounds = [
    { key: "title", src: "/images/title.png" },
    { key: "level", src: "/images/level.png" },
    ...(["EASY", "NORMAL", "HARD"] as DifficultyLevel[]).map((difficulty) => ({
      key: difficulty,
      src: DIFFICULTY_SETTINGS[difficulty].bg,
    })),
  ];
  const targetBgSrc = getCurrentBgSrc(); // Routerから取得

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
        <div id="game-wrapper">
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
          <div id="fade-overlay" style={{ opacity: isWhiteFade ? 1 : 0 }}></div>

          <GameCanvas gameState={gameState} playPhase={playPhase} />

          {gameState === "loading" && (
            <div id="loading-screen">
              <div className="keyboard-loader">
                {["L", "O", "A", "D", "I", "N", "G"].map((char, i) => (
                  <span key={i} className="key cat"
                    style={{ "--i": i} as React.CSSProperties}>
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
