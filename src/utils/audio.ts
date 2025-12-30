// ★修正: 足りないキーを追加
export type SoundKey = 
  'type' | 'miss' | 'correct' | 'gauge' | 'combo' | 'result' | 
  'decision' | 'cancel' | 'start' | 'finish' | 'bs' | 'diff' | 
  'rankS' | 'rankA' | 'rankB' | 'rankC' | 'rankD';

// 音声ファイルのパス定義
// ※実際のファイル名とパスが一致しているか再確認してください
const AUDIO_PATHS: Record<SoundKey, string> = {
    decision: "/bgm/決定.mp3",
    start:    "/bgm/start.mp3",
    diff:     "/bgm/303PM.wav", // 難易度選択BGM用? SEならここ
    type:     "/bgm/key.mp3",
    bs:       "/bgm/BackSpace.mp3",
    combo:    "/bgm/決定ボタンを押す26.mp3",
    gauge:    "/bgm/キラッ2.mp3",
    correct:  "/bgm/correct077.mp3",
    miss:     "/bgm/小キック.mp3",
    finish:   "/bgm/finish.mp3",
    result:   "/bgm/result.mp3",
    // ランクSE
    rankS:    "/bgm/rankS.mp3",
    rankA:    "/bgm/rankA.mp3",
    rankB:    "/bgm/rankB.mp3",
    rankC:    "/bgm/rankC.mp3",
    rankD:    "/bgm/rankD.mp3",
    // cancelキーの定義が漏れていた場合のダミー（必要ならファイルを用意）
    cancel:   "/bgm/決定.mp3" 
};

const audioCache: Partial<Record<SoundKey, HTMLAudioElement>> = {};
let bgmAudio: HTMLAudioElement | null = null;

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
    const audio = audioCache[key];
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch((e) => console.warn(`Sound error: ${key}`, e));
    } else {
        // キャッシュになければ都度生成（パスがあれば）
        const path = AUDIO_PATHS[key];
        if (path) {
            new Audio(path).play().catch((e) => console.warn(`Sound error: ${key}`, e));
        }
    }
};

// 個別の便利関数
export const playDecisionSound = () => playSE('decision');
export const playStartSound    = () => playSE('start');
export const playDiffSound     = () => playSE('diff'); // ★エラー解消
export const playTypeSound     = () => playSE('type');
export const playBsSound       = () => playSE('bs');
export const playCorrectSound  = () => playSE('correct');
export const playComboSound    = () => playSE('combo');
export const playGaugeSound    = () => playSE('gauge');
export const playMissSound     = () => playSE('miss');
export const playFinishSound   = () => playSE('finish');
export const playResultSound   = () => playSE('result');

// ★ランク系SE関数 (エラー解消)
export const playRankSSound    = () => playSE('rankS');
export const playRankASound    = () => playSE('rankA');
export const playRankBSound    = () => playSE('rankB');
export const playRankCSound    = () => playSE('rankC');
export const playRankDSound    = () => playSE('rankD');

// BGM再生
export const playGameBGM = (path: string) => {
    if (bgmAudio) {
        bgmAudio.pause();
    }
    bgmAudio = new Audio(path);
    bgmAudio.loop = true;
    bgmAudio.volume = 0.5;
    bgmAudio.play().catch(() => {});
};

export const startSelectBgm = () => {
    // 難易度選択画面のBGMパスが合っているか確認
    playGameBGM('/bgm/303PM.wav'); 
};

export const stopSelectBgm = () => {
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio = null;
    }
};

export const stopGameBGM = stopSelectBgm;
