// utils/audio.ts

// ★修正: 足りないキーを追加
export type SoundKey = 
  'type' | 'miss' | 'correct' | 'gauge' | 'combo' | 'result' | 
  'decision' | 'cancel' | 'start' | 'finish' | 'bs' | 'diff' | 
  'rankS' | 'rankA' | 'rankB' | 'rankC' | 'rankD';

// 音声ファイルのパス定義
const AUDIO_PATHS: Record<SoundKey, string> = {
    decision: "/bgm/決定.mp3",
    start:    "/bgm/start.mp3",
    diff:     "/bgm/303PM.wav",
    type:     "/bgm/key.mp3",
    bs:       "/bgm/BackSpace.mp3",
    combo:    "/bgm/決定ボタンを押す26.mp3",
    gauge:    "/bgm/キラッ2.mp3",
    correct:  "/bgm/correct077.mp3",
    miss:     "/bgm/小キック.mp3",
    finish:   "/bgm/finish.mp3",
    result:   "/bgm/result.mp3",
    rankS:    "/bgm/rankS.mp3",
    rankA:    "/bgm/rankA.mp3",
    rankB:    "/bgm/rankB.mp3",
    rankC:    "/bgm/rankC.mp3",
    rankD:    "/bgm/rankD.mp3",
    cancel:   "/bgm/決定.mp3" 
};

const audioCache: Partial<Record<SoundKey, HTMLAudioElement>> = {};
let bgmAudio: HTMLAudioElement | null = null;

// ★追加: 音量管理用変数 (初期値)
let isSystemMuted = false;
let bgmVolume = 0.5;
let seVolume = 0.8;

// ★追加: 外部から音量を変更する関数
export const setVolumes = (bgm: number, se: number) => {
    bgmVolume = bgm;
    seVolume = se;

    // 再生中のBGMがあればリアルタイムで音量を反映
    if (bgmAudio) {
        bgmAudio.volume = isSystemMuted ? 0 : bgmVolume;
    }
};

// ★追加: ミュート切り替え関数
export const setSystemMute = (mute: boolean) => {
    isSystemMuted = mute;

    // BGM再生中なら、ミュート時は音量0、解除時は設定音量に戻す
    if (bgmAudio) {
        bgmAudio.volume = mute ? 0 : bgmVolume;
    }
};

// 音声を事前読み込み
export const initAudio = () => {
    Object.entries(AUDIO_PATHS).forEach(([key, path]) => {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audioCache[key as SoundKey] = audio;
    });
};

// 効果音を再生
export const playSE = (key: SoundKey) => {
    // ★追加: ミュート時は再生しない
    if (isSystemMuted) return;

    let audio = audioCache[key];
    if (!audio) {
        // キャッシュになければ都度生成
        const path = AUDIO_PATHS[key];
        if (path) {
            audio = new Audio(path);
        } else {
            return;
        }
    }

    // 再生設定
    audio.currentTime = 0;
    audio.volume = seVolume; // ★追加: SE音量を適用
    audio.play().catch((e) => console.warn(`Sound error: ${key}`, e));
};

// 個別の便利関数
export const playDecisionSound = () => playSE('decision');
export const playStartSound    = () => playSE('start');
export const playDiffSound     = () => playSE('diff');
export const playTypeSound     = () => playSE('type');
export const playBsSound       = () => playSE('bs');
export const playCorrectSound  = () => playSE('correct');
export const playComboSound    = () => playSE('combo');
export const playGaugeSound    = () => playSE('gauge');
export const playMissSound     = () => playSE('miss');
export const playFinishSound   = () => playSE('finish');
export const playResultSound   = () => playSE('result');

export const playRankSSound    = () => playSE('rankS');
export const playRankASound    = () => playSE('rankA');
export const playRankBSound    = () => playSE('rankB');
export const playRankCSound    = () => playSE('rankC');
export const playRankDSound    = () => playSE('rankD');

// BGM再生
export const playGameBGM = (path: string) => {
    // 既に鳴っているBGMがあれば止める
    stopGameBGM();

    bgmAudio = new Audio(path);
    bgmAudio.loop = true;
    bgmAudio.volume = isSystemMuted ? 0 : bgmVolume; // ★追加: 設定音量か0かを判定
    bgmAudio.play().catch(() => {});
};

export const startSelectBgm = () => {
    // 既に同じ曲が流れているなら何もしない（重複防止）
    if (bgmAudio && !bgmAudio.paused && bgmAudio.src.includes('303PM.wav')) return;
    
    playGameBGM('/bgm/303PM.wav'); 
};

export const stopSelectBgm = () => {
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio = null;
    }
};

export const stopGameBGM = stopSelectBgm;