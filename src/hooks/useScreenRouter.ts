import { useCallback } from "react";
import { playSE, stopBGM, startSelectBgm } from "../utils/audio";
import { DIFFICULTY_SETTINGS, UI_TIMINGS } from "../utils/setting";
import {
  type DifficultyLevel,
  type GameState,
  type PlayPhase,
  type TitlePhase,
} from "../types";

type UseScreenRouterProps = {
  // State Values
  gameState: GameState;
  difficulty: DifficultyLevel;
  hoverDifficulty: DifficultyLevel | null;
  isTransitioning: boolean;
  isInputLocked: boolean;
  isTitleExiting: boolean;

  // State Setters
  setGameState: (state: GameState) => void;
  setPlayPhase: (phase: PlayPhase) => void;
  setDifficulty: (diff: DifficultyLevel) => void;
  setIsTransitioning: (is: boolean) => void;
  setIsInputLocked: (is: boolean) => void;
  setIsTitleExiting: (is: boolean) => void;
  setShowTitle: (show: boolean) => void;
  setEnableBounce: (enable: boolean) => void;
  setTitlePhase: (phase: TitlePhase) => void;

  // External Actions (他のHookから借りる関数)
  resetGame: () => void;
  resetResultState: () => void;
};

export const useScreenRouter = ({
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
  resetGame,
  resetResultState,
}: UseScreenRouterProps) => {
  // 難易度選択画面に戻るヘルパー関数
  const initiateGame = useCallback(() => {
    if(isTransitioning) return;
    setIsTransitioning(true);
    playSE("decision");
    resetGame();
    stopBGM();
    setTimeout(() => {
      setPlayPhase("ready");
      setGameState("playing");
      setIsTransitioning(false);
      setIsInputLocked(false);
    }, 50);
  }, [
    isTransitioning,
    setIsTransitioning,
    resetGame,
    setPlayPhase,
    setGameState,
    setIsInputLocked,
  ]);

  // 背景画像の取得
  const getCurrentBgSrc = useCallback(() => {
    if (gameState === "title") return "/images/title.jpg";
    if (gameState === "difficulty") {
      if (isTransitioning) return DIFFICULTY_SETTINGS[difficulty].bg;
      return hoverDifficulty
        ? DIFFICULTY_SETTINGS[hoverDifficulty].bg
        : "/images/level.jpg";
    }
    if (
      gameState === "playing" ||
      gameState === "finishing" ||
      gameState === "result"
    ) {
      return DIFFICULTY_SETTINGS[difficulty].bg;
    }
    return "/images/title.jpg";
  }, [gameState, difficulty, hoverDifficulty, isTransitioning]);

  // ゲーム制御: Readyに戻る
  const resetToReady = useCallback(() => {
    playSE("decision");
    stopBGM();
    resetGame();
    resetResultState();
    setPlayPhase("ready");
  }, [resetGame, resetResultState, setPlayPhase]);

  // 難易度選択に戻る
  const backToDifficulty = useCallback(() => {
    playSE("decision");
    if (gameState !== "hiscore_review") {
      stopBGM();
      startSelectBgm();
    }
    setGameState("difficulty");
    setIsTransitioning(false);
  }, [gameState, setGameState, setIsTransitioning]);

  // リトライ
  const retryGame = useCallback(() => {
    if (isTransitioning) return;
    initiateGame();
  }, [isTransitioning, initiateGame]);

  // タイトル → 難易度選択
  const goToDifficulty = useCallback(() => {
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
  }, [
    isTitleExiting,
    isInputLocked,
    setIsInputLocked,
    setIsTitleExiting,
    setGameState,
  ]);

  // 難易度決定 → ゲーム開始
  const handleSelectDifficulty = useCallback(
    (diff: DifficultyLevel) => {
      if (isTransitioning || isInputLocked) return;
      setDifficulty(diff);
      initiateGame();
    },
    [isTransitioning, isInputLocked, setDifficulty, initiateGame],
  );

  // 戻る: タイトルへ
  const backToTitle = useCallback(() => {
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
  }, [
    setGameState,
    setShowTitle,
    setEnableBounce,
    setIsTitleExiting,
    setIsInputLocked,
  ]);

  return {
    getCurrentBgSrc,
    resetToReady,
    backToDifficulty,
    retryGame,
    goToDifficulty,
    handleSelectDifficulty,
    backToTitle,
  };
};
