import type { Dispatch, SetStateAction } from "react";

import { DatabaseService } from "../services/database";
import { storage } from "../services/storage";
import { STORAGE_KEYS } from "../utils/constants";

type UseSaveNameParams = {
  userId: string;
  setPlayerName: Dispatch<SetStateAction<string>>;
};

// 未入力時はGuestで始めるようにしている
// また未入力時はそのままストレージにセットし、通信をカットしている
export const useSaveName = ({ userId, setPlayerName }: UseSaveNameParams) => {
  const saveName = (name: string) => {
    if (!name) {
      setPlayerName("Guest");
      storage.set(STORAGE_KEYS.PLAYER_NAME, "Guest");
      return;
    }

    setPlayerName(name);
    storage.set(STORAGE_KEYS.PLAYER_NAME, name);

    // userId がない（認証が終わっていない）場合は処理を中断
    if (!userId) return;

    DatabaseService.updateUserName(userId, name).catch(() => {
      setPlayerName("Guest");
      storage.set(STORAGE_KEYS.PLAYER_NAME, "Guest");
    });
  };

  return { saveName };
};
