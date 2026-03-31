import "./App.css";

import { useEffect, useState } from "react";

// --- Components ---
import { HowToPlay } from "./components/modals/HowToPlay";
import { Ranking } from "./components/modals/Ranking";
import { Setting } from "./components/modals/Setting";
import { BrightnessOverlay } from "./components/screens/BrightnessOverlay";
import { DifficultySelectScreen } from "./components/screens/Difficulty";
import { GameCanvas } from "./components/screens/GameCanvas";
import { GameScreen } from "./components/screens/GameScreen";
import { LoadingScreen } from "./components/screens/LoadingScreen";
import { ResultScreen } from "./components/screens/ResultScreen";
import { TitleScreen } from "./components/screens/TitleScreen";
import { useAuth } from "./hooks/useAuth";
import { useConfig } from "./hooks/useConfig";
import { useGameControl } from "./hooks/useGameControl";
import { useGameKeyHandler } from "./hooks/useGameKeyHandler";
import { useGameResult } from "./hooks/useGameResult";
import { useRanking } from "./hooks/useRanking";
import { useSaveName } from "./hooks/useSaveName";
import { useScaler } from "./hooks/useScaler";
import { useScreenRouter } from "./hooks/useScreenRouter";
import { useTitleFlow } from "./hooks/useTitleFlow";
import { useTypingGame } from "./hooks/useTypingGame";
import { DatabaseService } from "./services/database";
// 計算ロジック (分離済み)
import { ScoreService } from "./services/scoreService";
import {
  type DifficultyLevel,
  type GameResultStats,
  type GameState,
  type PlayPhase,
  type TitlePhase,
  type WordDataMap,
} from "./types";
import { initAudio, playSE } from "./utils/audio";
// --- Utils & Hooks ---
import {
  ALL_BACKGROUNDSDATA,
  DIFFICULTY_SETTINGS,
  LIMIT_DATA,
  STORAGE_KEYS,
  UI_TIMINGS,
} from "./utils/constants";
import { createGameStats } from "./utils/gameUtils";

const preloadImages = () => {
  const images = [
    "/images/level.webp",
    "/images/cloud.webp",
    "/images/Ready.webp",
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
    brightness,
    setBrightness,
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
    resetResultState,
  } = useGameResult(difficulty);

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

  const [dbWordData, setDbWordData] = useState<WordDataMap | null>(null);
  const [reviewData, setReviewData] = useState<GameResultStats | null>(null);

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
    resetGame,
    resetResultState,
  });

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

  const { userId, isLoading, error } = useAuth();

  const { saveName } = useSaveName({
    userId,
    setPlayerName,
  });

  const {
    handleStartSequence,
    handleCancelInput,
    handleNameSubmit,
    handleFinalConfirm,
    handleBackToInput,
    handleOpenConfig,
    handleCloseConfig,
    handleOpenHowToPlay,
    handleCloseHowToPlay,
  } = useTitleFlow({
    isInputLocked,
    isNameConfirmed,
    isTitleExiting,
    playerName,
    ngWordsList,
    saveName,
    goToDifficulty,
    setIsInputLocked,
    setIsTitleExiting,
    setNameError,
    setTitlePhase,
    setPlayerName,
    setIsNameConfirmed,
    setGameState,
    setShowConfig,
    setShowHowToPlay,
  });

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
    const startTime = performance.now();
    const checkLoad = setInterval(() => {
      const elapsedTime = performance.now() - startTime;
      if (dbWordData && elapsedTime > UI_TIMINGS.MIN_LOADING_TIME) {
        clearInterval(checkLoad);
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
    if (gameState === "result" && lastGameStats) {
      saveScore(lastGameStats, playerName);
      playResultAnimation(lastGameStats.rank);
    }
  }, [gameState, lastGameStats, saveScore, playResultAnimation, playerName]);

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
      ScoreService.getHighScoreResult(displayDiff) ??
      createGameStats({ score: ScoreService.getHighScore(displayDiff) });
    setReviewData(data);
    skipAnimation("S", false);
    setGameState("hiscore_review");
  };

  const {
    showRanking,
    rankingData,
    isRankingLoading,
    isDevRankingMode,
    rankingDataMode,
    fetchRanking,
    handleShowDevScore,
    closeRanking,
  } = useRanking({ difficulty, setDifficulty });

  const scalerRef = useScaler();

  // --- Key Handler ---
  useGameKeyHandler({
    gameState,
    playPhase,
    difficulty,
    handleKeyInput,
    handleBackspace,
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
      speed: currentSpeed,
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
                  opacity: currentBgSrc === bg.src ? 1 : 0,
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

            <main>
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
                    // ハイスコアモードでリザルト画面を使いまわしているため
                    // "hiscore_review"時の処理とリザルト画面演出スキップの分岐を設けている
                    // ここもだが全体的に処理の流れを追うのが大変になっている
                    // 設計を見直す必要があるためひとまず臨時でクリック音が鳴らないよう
                    // resultAnimStepを入れてクリックで音が鳴らないようにしている。
                    if (gameState === "hiscore_review") {
                      playSE("decision");
                      backToDifficulty();
                      return;
                    }
                    if (resultAnimStep < 5) {
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
            </main>
          </div>
        )}

        {showHowToPlay && <HowToPlay onClose={handleCloseHowToPlay} />}
        {showConfig && (
          <Setting
            playerName={playerName}
            isMuted={isMuted}
            bgmVol={bgmVol}
            seVol={seVol}
            brightness={brightness}
            showRomaji={showRomaji}
            ngWordsList={ngWordsList}
            setIsMuted={setIsMuted}
            setBgmVol={setBgmVol}
            setSeVol={setSeVol}
            setBrightness={setBrightness}
            setShowRomaji={setShowRomaji}
            onSaveName={saveName}
            onClose={handleCloseConfig}
          />
        )}
      </div>
      <BrightnessOverlay brightness={brightness} />
    </div>
  );
}

export default App;
