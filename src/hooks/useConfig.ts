/**
 * @file useConfig.ts
 * @description ゲーム設定（音量や表示オプション）を管理し、localStorageと同期するフック
 * * 【改善ポイント】
 * 1. getSafeStorage: 型チェックを追加し、不正なデータによるクラッシュを防止
 * 2. useEffectの分割: 設定項目ごとに保存処理を分け、不要なIO（書き込み）を削減
 */
import { useState, useEffect } from "react";
import { setSystemMute, setVolumes } from "../utils/audio";
import { STORAGE_KEYS, DEFAULT_CONFIG } from "../utils/setting";

// localStorageから安全に値を取得するヘルパー関数（強化版）
const getSafeStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue;
  
  const saved = localStorage.getItem(key);
  if (saved === null) return defaultValue;

  try {
    const parsed = JSON.parse(saved);

    // ★型ガード: 保存されていたデータの型が、初期値の型と違う場合は「壊れている」とみなす
    // (例: trueが入るべきところに "yamero" という文字列が入っていた場合など)
    if (typeof parsed !== typeof defaultValue) {
      console.warn(`Storage key "${key}" type mismatch. Resetting to default.`);
      return defaultValue;
    }

    return parsed as T;
  } catch (e) {
    console.error(`Storage key "${key}" parse error.`, e);
    return defaultValue;
  }
};

export const useConfig = () => {
  // 初期化は初回レンダリング時のみ行う (Lazy Initialization)
  const [isMuted, setIsMuted] = useState<boolean>(() => 
    getSafeStorage(STORAGE_KEYS.VOLUME_MUTE, DEFAULT_CONFIG.IS_MUTED)
  );
  
  const [bgmVol, setBgmVol] = useState<number>(() => 
    getSafeStorage(STORAGE_KEYS.VOLUME_BGM, DEFAULT_CONFIG.VOLUME_BGM_SE)
  );
  
  const [seVol, setSeVol] = useState<number>(() => 
    getSafeStorage(STORAGE_KEYS.VOLUME_SE, DEFAULT_CONFIG.VOLUME_BGM_SE)
  );
  
  const [showRomaji, setShowRomaji] = useState<boolean>(() => 
    getSafeStorage(STORAGE_KEYS.SHOW_ROMAJI, DEFAULT_CONFIG.SHOW_ROMAJI)
  );

  // --- 1. AudioEngineへの反映 (音が変わったら即座に反映) ---
  // ※ここは同期させたいので、値が変わるたびに実行してOK
  useEffect(() => {
    setSystemMute(isMuted);
  }, [isMuted]);

  useEffect(() => {
    setVolumes(bgmVol, seVol);
  }, [bgmVol, seVol]);

  // --- 2. localStorageへの保存 (パフォーマンス改善のため分割) ---
  
  // ミュート設定が変わった時だけ保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOLUME_MUTE, JSON.stringify(isMuted));
  }, [isMuted]);

  // BGM音量が変わった時だけ保存 (スライダー操作中、他の変数の保存を巻き込まない)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOLUME_BGM, JSON.stringify(bgmVol));
  }, [bgmVol]);

  // SE音量が変わった時だけ保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOLUME_SE, JSON.stringify(seVol));
  }, [seVol]);

  // ローマ字表示設定が変わった時だけ保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_ROMAJI, JSON.stringify(showRomaji));
  }, [showRomaji]);

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