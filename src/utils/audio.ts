import { AUDIO_PATHS, BGM_PATHS } from "./setting";
import { type SoundKey } from "../types";

const soundCache: Partial<Record<SoundKey, HTMLAudioElement>> = {};
let bgmAudio: HTMLAudioElement | null = null;

let isSystemMuted = false;
let bgmVolume = 0.5;
let seVolume = 0.5;

export const setVolumes = (bgm: number, se: number) => {
  bgmVolume = bgm;
  seVolume = se;
  if (bgmAudio) {
    bgmAudio.volume = isSystemMuted ? 0 : bgmVolume;
  }
};

export const setSystemMute = (mute: boolean) => {
  isSystemMuted = mute;
  if (bgmAudio) {
    bgmAudio.volume = mute ? 0 : bgmVolume;
  }
};

export const initAudio = () => {
  Object.entries(AUDIO_PATHS).forEach(([key, path]) => {
    const audio = new Audio(path);
    audio.preload = "auto";
    soundCache[key as SoundKey] = audio;
  });
};

/**
 * 効果音を再生する（汎用関数）
 */
export const playSE = (key: SoundKey) => {
  if (isSystemMuted || seVolume <= 0) return;

  const audio = soundCache[key] || new Audio(AUDIO_PATHS[key]);
  if (!soundCache[key]) soundCache[key] = audio; // キャッシュになければ保存

  audio.currentTime = 0;
  audio.volume = seVolume;
  audio.play().catch((e) => console.warn(`Sound error: ${key}`, e));
};

/**
 * BGMを停止する（一元化）
 */
export const stopBGM = () => {
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio = null;
  }
};

/**
 * BGMを再生する（汎用化）
 */
export const playBGM = (path: string) => {
  const targetVolume = isSystemMuted ? 0 : bgmVolume;

  if (targetVolume <= 0) {
    stopBGM(); // いったん曲を止めてから
    return; // 処理を抜ける
  }

  // 「BGMが存在し」かつ「再生中で」かつ「リクエストされた曲と同じ」なら、
  // 何もせず帰る（＝曲を流しっぱなしにする）
  if (bgmAudio && !bgmAudio.paused && bgmAudio.src.includes(path)) {
    bgmAudio.volume = targetVolume;
    return;
  }

  stopBGM(); //曲の切り替えもあるためここでも一度止めておく
  bgmAudio = new Audio(path);
  bgmAudio.loop = true;
  bgmAudio.volume = targetVolume;
  bgmAudio.play().catch((e) => {
    console.warn("BGM Play failed (Auto-play policy or low power mode):", e);
  });
};

// 特定のシーン用のBGM関数
export const startSelectBgm = () => {
  playBGM(BGM_PATHS.SELECT);
};
