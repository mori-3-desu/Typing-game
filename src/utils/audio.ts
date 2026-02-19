import { AUDIO_PATHS, BGM_PATHS } from "./setting";
import { type SoundKey } from "../types";

/**
 * ■ 学習ポイント: 型定義の拡張 (Global Augmentation)
 * 通常、グローバル変数を増やすのは「行儀が悪い」とされますが、
 * これは「ブラウザ(Window)には元々 webkitAudioContext が存在するのに、
 * TypeScriptの標準型定義に載っていない」という欠けを補うための記述です。
 * 既存の Window インターフェースに型を「マージ（結合）」しています。
 */
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext; // Safari(iOS)向けの古い規格
  }
}

// ■ Web Audio API コンテキストの作成
// AudioContext は「音を鳴らす工場」のようなもの。ブラウザで1つだけ作ればOKです。
// (シングルトンパターン)
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextClass();

// ■ 音源データのキャッシュ (AudioBuffer)
// ファイルをロード・デコードした結果をメモリに保存しておきます。
// 2回目以降はここから読むので、爆速で再生できます。
const soundBuffers: Partial<Record<SoundKey, AudioBuffer>> = {};
const bgmBuffers: Record<string, AudioBuffer> = {};

// ■ 再生制御用変数
// SE(効果音)は「使い捨て」なので管理しませんが、
// BGMは「停止」「音量変更」が必要なので、ノード(制御用オブジェクト)を変数で持ちます。
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGainNode: GainNode | null = null;

// ■ 学習ポイント: 競合状態（Race Condition）の防止策
// 「今、システムとして流すべき正解の曲はどれか？」を管理します。
// 非同期ロード中に別の曲がリクエストされた場合、この変数と比較することで
// 「古いリクエスト」を捨てることができます。
let currentTargetBgmPath: string | null = null;

// 設定値
let isSystemMuted = false;
let bgmVolume = 0.5;
let seVolume = 0.5;

// -----------------------------------------------------------------------------
// Helper Functions (内部処理用)
// -----------------------------------------------------------------------------

/**
 * AudioContextの「寝起き」対策
 * 最近のブラウザ(Chrome/Safari)は、ユーザーがクリックなどの操作をするまで
 * AudioContextを勝手に「停止(suspended)」させます。
 * これを叩き起こさないと、最初の音が鳴りません。
 */
const ensureContextResumed = () => {
  if (audioCtx.state === "suspended") {
    // 非同期で復帰を試みる（失敗してもログだけ出して落ちないようにcatchする）
    audioCtx
      .resume()
      .catch((e) => console.warn("AudioContext resume failed:", e));
  }
};

/**
 * 音声ファイルのロードとデコード
 * 1. fetch: サーバーからファイルを取得
 * 2. arrayBuffer: バイナリデータとして読み込む
 * 3. decodeAudioData: mp3やwavを「生の波形データ(PCM)」に変換してメモリに展開
 */
const loadAudio = async (path: string): Promise<AudioBuffer> => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  // decodeAudioDataはCPUを使う重い処理なので、initAudioで事前に済ませるのが定石
  return await audioCtx.decodeAudioData(arrayBuffer);
};

// -----------------------------------------------------------------------------
// Exported Functions (外部から使う関数)
// -----------------------------------------------------------------------------

/**
 * 音量の変更
 */
export const setVolumes = (bgm: number, se: number) => {
  bgmVolume = bgm;
  seVolume = se;
  if (bgmGainNode) {
    const vol = isSystemMuted ? 0 : bgmVolume;
    // ■ 学習ポイント: setTargetAtTime
    // 単に .value = vol とすると、波形の途中で急に音量が変わって「プチッ」という
    // ノイズ(Pop noise)が乗ることがあります。
    // これを使うと 0.1秒かけて滑らかに音量を変えてくれるので、ノイズを防げます。
    bgmGainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
  }
};

/**
 * ミュート切替
 */
export const setSystemMute = (mute: boolean) => {
  isSystemMuted = mute;
  if (bgmGainNode) {
    const vol = mute ? 0 : bgmVolume;
    bgmGainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
  }
};

/**
 * 初期化処理
 * ゲーム開始前にすべての音声をロードしておきます。
 */
export const initAudio = async () => {
  // ■ 学習ポイント: 並列処理 (Promise.all)
  // SEとBGMを1つずつ順番にロードすると遅いので、
  // 全てのリクエストを一斉に投げて、全部終わるのを待ちます。
  const promises = [
    ...Object.entries(AUDIO_PATHS).map(async ([key, path]) => {
      try {
        const buffer = await loadAudio(path);
        soundBuffers[key as SoundKey] = buffer;
      } catch (e) {
        console.error(`SE Load Error (${key}):`, e);
      }
    }),
    ...Object.entries(BGM_PATHS).map(async ([, path]) => {
      try {
        const buffer = await loadAudio(path);
        bgmBuffers[path] = buffer;
      } catch (e) {
        console.error(`BGM Load Error (${path}):`, e);
      }
    }),
  ];

  await Promise.all(promises);

  // ■ 学習ポイント: ユーザーインタラクションでのアンロック
  // スマホなどでは「ユーザーが画面を触るまで音を出してはいけない」という強い制限があります。
  // そのため、最初のクリックやキー入力のイベントで ensureContextResumed を呼びます。
  const unlock = () => {
    ensureContextResumed();
    // 一度解除できればイベントリスナーは不要なので消します（メモリ節約）
    document.removeEventListener("click", unlock);
    document.removeEventListener("keydown", unlock);
  };
  document.addEventListener("click", unlock);
  document.addEventListener("keydown", unlock);
};

/**
 * 効果音(SE)の再生
 */
export const playSE = (key: SoundKey) => {
  // タブが裏にある時は処理をしない
  if (document.hidden) return;

  if (isSystemMuted || seVolume <= 0) return;

  // 再生直前にも念のため「起きろ！」と命令
  ensureContextResumed();

  const buffer = soundBuffers[key];
  if (!buffer) return;

  // ■ 学習ポイント: SourceNodeの使い捨て
  // Web Audio APIでは、音源(SourceNode)は「一度再生したら終わり」です。
  // 毎回新しく createBufferSource することで、
  // 以前の音を止めずに、音を「重ねて」再生することができます（マシンガン打ち対応）。
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = seVolume;

  // 配線: [音源] -> [音量調整] -> [スピーカー(destination)]
  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // 0秒後(今すぐ)再生開始
  source.start(0);

  // ※再生が終わったNodeは自動的にガベージコレクション(メモリ破棄)されるので、
  //  手動での後始末は不要です。
};

/**
 * BGM停止処理
 */
export const stopBGM = () => {
  // 「今は何も流すべき曲はない」と宣言
  currentTargetBgmPath = null;

  if (bgmSource) {
    try {
      bgmSource.stop();
    } catch {
      /* 既に止まっていた場合のエラーは無視 */
    }

    // ■ 学習ポイント: 切断 (disconnect)
    // 停止したノードをスピーカーから切り離します。
    // これをしないとメモリリーク（メモリのゴミが溜まる）の原因になります。
    bgmSource.disconnect();
    bgmSource = null;
  }
  if (bgmGainNode) {
    bgmGainNode.disconnect();
    bgmGainNode = null;
  }
};

/**
 * BGM内部再生処理 (バッファがある状態で呼ばれる)
 */
const playBuffer = (buffer: AudioBuffer) => {
  const targetVolume = isSystemMuted ? 0 : bgmVolume;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true; // BGMなのでループ有効

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = targetVolume;

  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  source.start(0);

  // 停止や音量変更のために、現在のノードを変数に保持しておく
  bgmSource = source;
  bgmGainNode = gainNode;
};

/**
 * BGM再生（メイン関数）
 * asyncがついているのは、ロード待ちが発生する可能性があるため
 */
export const playBGM = async (path: string) => {
  ensureContextResumed();

  const targetVolume = isSystemMuted ? 0 : bgmVolume;

  // ■ 既にその曲がターゲットなら何もしない
  // これにより、Reactの再レンダリング等で playBGM が連打されても
  // 曲が最初からリセットされるのを防げます。
  if (currentTargetBgmPath === path) {
    // 音量だけは最新に合わせておく（フェードイン/アウト対応）
    if (bgmGainNode) {
      bgmGainNode.gain.setTargetAtTime(targetVolume, audioCtx.currentTime, 0.1);
    }
    return;
  }

  // 別の曲にするので、まずは既存のBGMを止める
  stopBGM();

  // 音量0なら「再生予定なし」として終了
  if (targetVolume <= 0) return;

  // ★重要: 「これからこの曲を流すのが正解」とセット
  currentTargetBgmPath = path;

  // キャッシュチェック
  const cachedBuffer = bgmBuffers[path];
  if (cachedBuffer) {
    // キャッシュにあれば即再生
    playBuffer(cachedBuffer);
  } else {
    // キャッシュになければロード開始
    try {
      // awaitしている間に、stopBGM()されたり、別の曲がリクエストされる可能性がある
      const decodedBuf = await loadAudio(path);
      bgmBuffers[path] = decodedBuf; // キャッシュ保存

      // ★学習ポイント: 追い越し防止 (Race Condition Check)
      // ロードが終わったこの瞬間に、「本当に流すべき曲」はまだこの path か？を確認。
      // もしロード中に stopBGM() が呼ばれていたら currentTargetBgmPath は null になっている。
      // もし別の playBGM("B") が呼ばれていたら currentTargetBgmPath は "B" になっている。
      // どちらの場合も、この "path" (A) は再生してはいけない。
      if (currentTargetBgmPath === path) {
        playBuffer(decodedBuf);
      } else {
        // console.log("ロード完了しましたが、別のリクエストが優先されたため破棄します");
      }
    } catch (e) {
      console.error(`BGM Load Failed: ${path}`, e);
      // エラー時は状態をリセットして、「再生中」のままになるのを防ぐ
      if (currentTargetBgmPath === path) {
        currentTargetBgmPath = null;
      }
    }
  }
};

export const startSelectBgm = () => {
  playBGM(BGM_PATHS.SELECT);
};

// ユーザーが他のタブを見てた時、無駄な音声処理を防ぐことでCPUの節約になる
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (audioCtx.state === "running") {
      audioCtx.suspend().catch(() => {});
    }
  } else {
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch((err) => console.error("Resume failed:", err));
    }
  }
});
