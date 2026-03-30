import type { Dispatch, SetStateAction } from "react";
import type { TitlePhase, GameState } from "../types";
import { playSE, startSelectBgm } from "../utils/audio";
import {
  UI_TIMINGS,
  PLAYER_NAME_CHARS,
  STORAGE_KEYS,
} from "../utils/constants";
import { DatabaseService } from "../services/database";

type UseTitleParams = {
  isInputLocked: boolean;
  isNameConfirmed: boolean;
  isTitleExiting: boolean;
  playerName: string;
  ngWordsList: string[];
  userId: string | null;

  // 関数系（外から受け取るもの）
  goToDifficulty: () => void;

  // setter系
  setIsInputLocked: Dispatch<SetStateAction<boolean>>;
  setIsTitleExiting: Dispatch<SetStateAction<boolean>>;
  setNameError: Dispatch<SetStateAction<string>>;
  setTitlePhase: Dispatch<SetStateAction<TitlePhase>>;
  setPlayerName: Dispatch<SetStateAction<string>>;
  setIsNameConfirmed: Dispatch<SetStateAction<boolean>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setShowConfig: Dispatch<SetStateAction<boolean>>;
  setShowHowToPlay: Dispatch<SetStateAction<boolean>>;
};

// 入力された名前のバリデーションチェック
const validateName = (name: string, ngWordsList: string[]): string | null => {
  if (name.length > PLAYER_NAME_CHARS.MAX) {
    return `名前は${PLAYER_NAME_CHARS.MAX}文字以内で入力してください`;
  }

  const isNg = ngWordsList.some((word) =>
    name.toLowerCase().includes(word.toLowerCase()),
  );
  if (isNg) {
    return "不適切な文字が含まれています";
  }

  return null;
};

export const useTitleFlow = ({
  isInputLocked,
  isNameConfirmed,
  isTitleExiting,
  playerName,
  ngWordsList,
  userId,
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
}: UseTitleParams) => {
  const handleStartSequence = () => {
    if (isTitleExiting || isInputLocked) return;
    if (isNameConfirmed) {
      goToDifficulty();
      return;
    }
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
    setTitlePhase("normal");
  };

  // 実行用(未入力はGuestで始めるようにしている)
  const handleNameSubmit = () => {
    const trimmedName = playerName.trim();
    setNameError("");

    const errorMessage = validateName(trimmedName, ngWordsList);

    if (errorMessage) {
      setNameError(errorMessage);
      return;
    }

    setPlayerName(trimmedName || "Guest");
    setTitlePhase("confirm");
  };

  const handleFinalConfirm = () => {
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, playerName);
    startSelectBgm();
    setIsNameConfirmed(true);
    setGameState("difficulty");
    setTitlePhase("normal");
  };

  const handleBackToInput = () => {
    setTitlePhase("input");
  };

  const handleOpenConfig = () => {
    setShowConfig(true);
  };

  const handleCloseConfig = () => {
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
    setShowHowToPlay(true);
  };

  const handleCloseHowToPlay = () => {
    playSE("decision");
    setShowHowToPlay(false);
  };

  return {
    handleStartSequence,
    handleCancelInput,
    handleNameSubmit,
    handleFinalConfirm,
    handleBackToInput,
    handleOpenConfig,
    handleCloseConfig,
    handleSaveName,
    handleOpenHowToPlay,
    handleCloseHowToPlay,
  };
};
