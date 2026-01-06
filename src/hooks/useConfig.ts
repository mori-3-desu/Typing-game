import { useState, useEffect } from 'react';
import { setSystemMute, setVolumes } from '../utils/audio'; // ※パスは環境に合わせて調整してください

export const useConfig = () => {
  // --- 1. Stateの定義 (App.tsxから移動) ---
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('typing_is_muted') === 'true';
  });

  const [bgmVol, setBgmVol] = useState(() => parseFloat(localStorage.getItem('typing_bgm_vol') || "0.5"));
  
  const [seVol, setSeVol] = useState(() => parseFloat(localStorage.getItem('typing_se_vol') || "0.8"));

  const [showRomaji, setShowRomaji] = useState(() => {
    const saved = localStorage.getItem('typing_show_romaji');
    return saved === null ? true : saved === 'true';
  });

  // --- 2. 副作用の定義 (useEffectも移動) ---
  useEffect(() => {
    // 音量やミュートをシステムに反映
    setSystemMute(isMuted);
    setVolumes(bgmVol, seVol);
    
    // localStorageに保存
    localStorage.setItem('typing_is_muted', isMuted.toString());
    localStorage.setItem('typing_bgm_vol', bgmVol.toString());
    localStorage.setItem('typing_se_vol', seVol.toString());
    localStorage.setItem('typing_show_romaji', showRomaji.toString());
  }, [isMuted, bgmVol, seVol, showRomaji]);

  // --- 3. App.tsxで使うものだけをまとめて返す ---
  return {
    isMuted, setIsMuted,
    bgmVol, setBgmVol,
    seVol, setSeVol,
    showRomaji, setShowRomaji
  };
};