/**
 * localStorageから安全に値を取得し、型を復元する
 * @param key 保存キー
 * @param defaultValue 値がなかった場合の初期値
 */
import { useState, useEffect } from "react";
import { setSystemMute, setVolumes } from "../utils/audio";
import { STORAGE_KEYS, DEFAULT_CONFIG } from "../utils/setting";

// localStorageから安全に値を取得するヘルパー関数(似たような関数をひとまとめにしました。JSON.parse使うならnull判定とtry-catchは必要)
const getSafeStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue;
  const saved = localStorage.getItem(key);
  if (saved === null) return defaultValue;
  try {
    return JSON.parse(saved) as T;
  } catch {
    return defaultValue;
  }
};

export const useConfig = () => {
  const [isMuted, setIsMuted] = useState<boolean>(() => getSafeStorage(STORAGE_KEYS.VOLUME_MUTE, DEFAULT_CONFIG.IS_MUTED
  ));
  // BGMがうるさくなるSEの初期値だと小さい等の可能性があるため定数を分けることを検討してください
  const [bgmVol, setBgmVol] = useState<number>(() => getSafeStorage(STORAGE_KEYS.VOLUME_BGM, DEFAULT_CONFIG.VOLUME_BGM_SE));
  const [seVol, setSeVol] = useState<number>(() => getSafeStorage(STORAGE_KEYS.VOLUME_SE, DEFAULT_CONFIG.VOLUME_BGM_SE));
  const [showRomaji, setShowRomaji] = useState<boolean>(() => getSafeStorage(STORAGE_KEYS.SHOW_ROMAJI, DEFAULT_CONFIG.SHOW_ROMAJI));

  useEffect(() => {
    setSystemMute(isMuted);
    setVolumes(bgmVol, seVol);

    // .toString() ではなく JSON.stringify() を使うと、JSON.parse との相性が完璧になります
    // (将来配列やオブジェクトとして保存したくなった時にtostringだと[object Object]という文字になって壊れる)
    localStorage.setItem(STORAGE_KEYS.VOLUME_MUTE, JSON.stringify(isMuted));
    localStorage.setItem(STORAGE_KEYS.VOLUME_BGM, JSON.stringify(bgmVol));
    localStorage.setItem(STORAGE_KEYS.VOLUME_SE, JSON.stringify(seVol));
    localStorage.setItem(STORAGE_KEYS.SHOW_ROMAJI, JSON.stringify(showRomaji));
  }, [isMuted, bgmVol, seVol, showRomaji]);

  // App.tsxで使うものだけをまとめて返す 
  return {
    isMuted,
    setIsMuted,
    bgmVol,
    setBgmVol,
    seVol,
    setSeVol,
    showRomaji,
    setShowRomaji,
  };
};
