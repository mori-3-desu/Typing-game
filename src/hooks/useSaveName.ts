import type { Dispatch, SetStateAction } from "react";

import { DatabaseService } from "../services/database";
import { storage } from "../services/storage";
import { STORAGE_KEYS } from "../utils/constants";

type UseSaveNameParams = {
  userId: string;
  setPlayerName: Dispatch<SetStateAction<string>>;
};

// 名前の保存口。タイトル確定と設定画面のリネームで共用する。
// リモート更新(PATCH)が成功してからローカル(state / localStorage)へ反映する。
// 失敗時は throw し、名前は一切変更しない（呼び出し側が結果をハンドリングする）。
export const useSaveName = ({ userId, setPlayerName }: UseSaveNameParams) => {
  const applyLocally = (name: string) => {
    setPlayerName(name);
    storage.set(STORAGE_KEYS.PLAYER_NAME, name);
  };

  const saveName = async (name: string): Promise<void> => {
    // 未入力は Guest としてローカルのみ保存(通信カット)
    if (!name) {
      applyLocally("Guest");
      return;
    }

    // 認証前はリモート保存できないためローカルのみ
    if (!userId) {
      applyLocally(name);
      return;
    }

    // PATCH 成功後にローカル反映。失敗時は throw され、ここから先は通らない
    await DatabaseService.updateUserName(name);
    applyLocally(name);
  };

  return { saveName };
};
