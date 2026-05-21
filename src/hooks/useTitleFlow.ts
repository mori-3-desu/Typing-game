import type { Dispatch, SetStateAction } from "react";

import { DatabaseService } from "../services/database";
import type { GameState, TitlePhase } from "../types";
import { startSelectBgm } from "../utils/audio";
import { PLAYER_NAME_CHARS, UI_TIMINGS } from "../utils/constants";

type UseTitleParams = {
  isInputLocked: boolean;
  isNameConfirmed: boolean;
  isTitleExiting: boolean;
  playerName: string;

  saveName: (name: string) => Promise<void>;
  goToDifficulty: () => void;

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

export const useTitleFlow = ({
  isInputLocked,
  isNameConfirmed,
  isTitleExiting,
  playerName,
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
  const handleNameSubmit = async () => {
    const trimmedName = playerName.trim();
    setNameError("");

    // 長さはクライアントで即時チェック(サーバーも @Size で担保)
    if (trimmedName.length > PLAYER_NAME_CHARS.MAX) {
      setNameError(`名前は${PLAYER_NAME_CHARS.MAX}文字以内で入力してください`);
      return;
    }

    // 未入力は Guest で開始。検証 API は空名を弾く(@NotBlank)ため呼ばない
    if (trimmedName === "") {
      setPlayerName("Guest");
      setTitlePhase("confirm");
      return;
    }

    try {
      const isValid = await DatabaseService.validateUserName(trimmedName);
      if (!isValid) {
        setNameError("不適切な文字が含まれています");
        return;
      }
    } catch (error: unknown) {
      // 検証 API が落ちた場合は安全側に倒して Guest で進める。
      // 未検証の名前を通すと後続のスコア登録(NG検証あり)で弾かれるため、
      // 既知の安全値にフォールバックして経路全体を壊さない。
      console.error("名前検証に失敗しました:", error);
      setPlayerName("Guest");
      setTitlePhase("confirm");
      return;
    }

    setPlayerName(trimmedName);
    setTitlePhase("confirm");
  };

  const handleFinalConfirm = () => {
    // 名前保存は best-effort。失敗してもゲーム進行は止めない
    saveName(playerName).catch((error: unknown) => {
      console.error("名前の保存に失敗しました:", error);
    });
    startSelectBgm();
    setIsNameConfirmed(true);
    setGameState("difficulty");
    setTitlePhase("normal");
  };

  const handleBackToInput = () => setTitlePhase("input");
  const handleOpenConfig = () => setShowConfig(true);
  const handleCloseConfig = () => setShowConfig(false);
  const handleOpenHowToPlay = () => setShowHowToPlay(true);
  const handleCloseHowToPlay = () => setShowHowToPlay(false);

  return {
    handleStartSequence,
    handleCancelInput,
    handleNameSubmit,
    handleFinalConfirm,
    handleBackToInput,
    handleOpenConfig,
    handleCloseConfig,
    handleOpenHowToPlay,
    handleCloseHowToPlay,
  };
};
