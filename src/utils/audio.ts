import { AUDIO_PATHS } from "./setting";
import { type SoundKey } from "../types";

// BGM管理用の定数（マジックストリング対策）
const BGM_PATHS = {
  SELECT: "/bgm/303PM.wav",
  // 他にゲーム中のBGMなどがあればここに追加
} as const;

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
  if (isSystemMuted) return;

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
  // 「BGMが存在し」かつ「再生中で」かつ「リクエストされた曲と同じ」なら、
  // 何もせず帰る（＝曲を流しっぱなしにする）
  if (bgmAudio && !bgmAudio.paused && bgmAudio.src.includes(path)) {
    return;
  }

  stopBGM(); //まずは、前の曲を止める
  bgmAudio = new Audio(path);
  bgmAudio.loop = true;
  // ミュート中なら音量を0にしておく
  bgmAudio.volume = isSystemMuted ? 0 : bgmVolume;
  bgmAudio.play().catch(() => {});
};

// 特定のシーン用のBGM関数
export const startSelectBgm = () => {
  playBGM(BGM_PATHS.SELECT);
};