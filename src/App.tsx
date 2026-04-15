import "./App.css";

import { useEffect, useState } from "react";

import { HowToPlay } from "./components/modals/HowToPlay";
import { Ranking } from "./components/modals/Ranking";
import { Setting } from "./components/modals/Setting";
import { BrightnessOverlay } from "./components/screens/BrightnessOverlay";
import { DifficultySelectScreen } from "./components/screens/Difficulty";
import { GameCanvas } from "./components/screens/GameCanvas";
import { GameScreen } from "./components/screens/GameScreen";
import { LoadingScreen } from "./components/screens/LoadingScreen";
import { ResultScreen } from "./components/screens/ResultScreen";
import { ScalerWrapper } from "./components/screens/ScalerWrapper";
import { TitleScreen } from "./components/screens/TitleScreen";
import { useAppInit } from "./hooks/useAppInit";
import { useAuth } from "./hooks/useAuth";
import { useConfig } from "./hooks/useConfig";
import { useGameControl } from "./hooks/useGameControl";
import { useGameKeyHandler } from "./hooks/useGameKeyHandler";
import { useGameResult } from "./hooks/useGameResult";
import { useRanking } from "./hooks/useRanking";
import { useSaveName } from "./hooks/useSaveName";
import { useScreenRouter } from "./hooks/useScreenRouter";
import { useTitleFlow } from "./hooks/useTitleFlow";
import { useTypingGame } from "./hooks/useTypingGame";
import { ScoreService } from "./services/scoreService";
import type {
  DifficultyLevel,
  GameResultStats,
  GameState,
  PlayPhase,
  TitlePhase,
} from "./types";
import { playSE } from "./utils/audio";
import {
  ALL_BACKGROUNDSDATA,
  STORAGE_KEYS,
  UI_TIMINGS,
} from "./utils/constants";
import {
  buildDisplayData,
  createGameStats,
  getShareUrl,
} from "./utils/gameUtils";

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

  const [nameError, setNameError] = useState("");
  const [gameState, setGameState] = useState<GameState>("loading");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("NORMAL");
  const [playPhase, setPlayPhase] = useState<PlayPhase>("ready");
  const [showConfig, setShowConfig] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [hoverDifficulty, setHoverDifficulty] =
    useState<DifficultyLevel | null>(null);
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || "";
  });
  const [isNameConfirmed, setIsNameConfirmed] = useState(() => {
    return !!localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
  });
  const [titlePhase, setTitlePhase] = useState<TitlePhase>("normal");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInputLocked, setIsInputLocked] = useState(true);
  const [showTitle, setShowTitle] = useState(false);
  const [enableBounce, setEnableBounce] = useState(false);
  const [isTitleExiting, setIsTitleExiting] = useState(false);
  const [reviewData, setReviewData] = useState<GameResultStats | null>(null);

  const { ngWordsList, dbWordData } = useAppInit();
  const { userId, isLoading, error } = useAuth();

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

  const { saveName } = useSaveName({
    userId,
    setPlayerName,
  });

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

  // ここから下は設計を見直す箇所であるため、一時的に
  // App.tsxに置いている
  useEffect(() => {
    if (!dbWordData) return;

    const startTime = performance.now();
    const timers: number[] = [];

    // 配列方式にしてtimeoutをクリアする
    const schedule = (fn: () => void, delay: number) => {
      timers.push(window.setTimeout(fn, delay));
    };

    const checkLoad = setInterval(() => {
      const elapsed = performance.now() - startTime;
      if (elapsed < UI_TIMINGS.MIN_LOADING_TIME) return;

      clearInterval(checkLoad);
      setGameState("title");

      schedule(() => {
        setShowTitle(true);
      }, UI_TIMINGS.TITLE.SHOW_DELAY);

      schedule(() => {
        setEnableBounce(true);
        setIsInputLocked(false);
      }, UI_TIMINGS.TITLE.SHOW_DELAY + UI_TIMINGS.TITLE.BOUNCE_DELAY);
    }, 100);

    return () => {
      clearInterval(checkLoad);
      timers.forEach(clearTimeout);
    };
  }, [dbWordData]);

  useEffect(() => {
    if (gameState === "result" && lastGameStats) {
      saveScore(lastGameStats, playerName);
      playResultAnimation(lastGameStats.rank);
    }
  }, [gameState, lastGameStats, saveScore, playResultAnimation, playerName]);

  const handleShowHighScoreDetail = () => {
    const displayDiff = hoverDifficulty || difficulty;
    const data =
      ScoreService.getHighScoreResult(displayDiff) ??
      createGameStats({ score: ScoreService.getHighScore(displayDiff) });
    setReviewData(data);
    skipAnimation("S", false);
    setGameState("hiscore_review");
  };

  const hiscoreModeResult = () => {
    // ハイスコアモードでリザルト画面を使いまわしているため
    // "hiscore_review"時の処理とリザルト画面演出スキップの分岐を設けている
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
  };

  const isAnyModalOpen = showRanking || showHowToPlay || showConfig;
  const displayData = buildDisplayData(gameState, reviewData, lastGameStats);
  const tweetUrl = () => getShareUrl(displayData.score, displayData.rank);

  return (
    <div className="App">
      <ScalerWrapper>
        {isLoading ? (
          <LoadingScreen />
        ) : error ? (
          <div className="error-fallback">
            Error: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : (
          <div className="game-wrapper">
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

            <div inert={isAnyModalOpen || undefined}>
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
                    onTweet={tweetUrl}
                    onClickScreen={hiscoreModeResult}
                  />
                )}
              </main>
            </div>
          </div>
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
      </ScalerWrapper>
      <BrightnessOverlay brightness={brightness} />
    </div>
  );
}

export default App;
