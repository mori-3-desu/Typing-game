import type { Dispatch, SetStateAction } from "react";

import { DatabaseService } from "../services/database";
import { storage } from "../services/storage";
import { STORAGE_KEYS } from "../utils/constants";

type UseSaveNameParams = {
  setPlayerName: Dispatch<SetStateAction<string>>;
};

// 設定画面でのリネーム専用。リモート更新(PATCH)が成功してから
// ローカル(state / localStorage)へ反映する。
// 失敗時は throw し、名前は一切変更しない（呼び出し側が結果をハンドリングする）。
export const useSaveName = ({ setPlayerName }: UseSaveNameParams) => {
  const applyLocally = (name: string) => {
    setPlayerName(name);
    storage.set(STORAGE_KEYS.PLAYER_NAME, name);
  };

  const saveName = async (name: string): Promise<void> => {
    await DatabaseService.updateUserName(name);
    applyLocally(name);
  };

  return { saveName };
};
