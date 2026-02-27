/**
 * @file useTypingEngine.ts
 * @description タイピングゲームのコアロジック（UIを持たない純粋な頭脳）
 * * 【全体の設計思想】
 * - Segment: 「しゃ」や「か」など、1つのまとまり（ブロック）を担当する「現場の作業員」
 * - TypingEngine: 文章全体を管理し、どの作業員にキーを渡すか指示する「現場監督」
 */

import { ROMA_VARIATIONS } from "../utils/romajiMap";
import { JUDGE_COLOR } from "../utils/setting";

// 静的ソート（アプリ起動時に1回だけ実行）
// 長い文字（"shi" など）から先にマッチさせるため、文字数の多い順にソートしておく
const SORTED_ROMA_KEYS = Object.keys(ROMA_VARIATIONS).sort(
  (a, b) => b.length - a.length,
);

/**
 * 現場の作業員（Segment クラス）
 * 1つの日本語ブロック（例："か"、"しゃ"、"ん"）に対する、ユーザーの入力状態を管理する
 */
export class Segment {
  canonical: string; // 正解のベースとなる文字（例："しゃ"）
  patterns: string[]; // 入力パターンの候補（例：["sya", "sha"]）
  inputBuffer: string; // ユーザーが現在までに打った文字（例："s"）
  typedLog: { char: string; color: string }[]; // 画面の色分け用の履歴
  isExpanded: boolean; // 「ん」が "n" から "nn" に拡張されたかどうかのフラグ

  constructor(canonical: string) {
    this.canonical = canonical;
    // 辞書にない記号などは、そのままの文字をパターンとして登録
    this.patterns = ROMA_VARIATIONS[canonical] || [canonical];
    this.inputBuffer = "";
    this.typedLog = [];
    this.isExpanded = false;
  }

  // 画面に薄く表示する「お手本（ガイド）」を取得する
  get display() {
    if (this.inputBuffer === "") return this.patterns[0]; // まだ打ってないなら基本パターンを出す
    // ユーザーの入力（例:"sh"）に一致する未来のパターン("sha")を探す
    const match = this.patterns.find((p) => p.startsWith(this.inputBuffer));
    return match ? match : this.patterns[0];
  }

  // 次に打つべき「1文字」を取得（"sha"で"s"まで打ってたら"h"を返す）
  getCurrentChar() {
    return this.display[this.inputBuffer.length] || "";
  }

  // まだ打たれていない残りの文字列を取得
  getRemaining() {
    return this.display.slice(this.inputBuffer.length + 1);
  }

  /**
   * ★追加メソッド1: 試し打ちチェック
   * 状態（buffer）は変更せずに、「もしこのキーが来たら正解ルートに乗れるか？」だけを判定する
   */
  canAccept(key: string): boolean {
    return this.patterns.some((p) => p.startsWith(this.inputBuffer + key));
  }

  /**
   * ★追加メソッド2: n単体かどうかチェック
   * 「ん」を "n" 1文字で済ませた状態かどうか。（次の文字の判定に使う）
   */
  isSingleN(): boolean {
    return this.canonical === "n" && this.inputBuffer === "n";
  }

  /**
   * ★追加メソッド3: nnへの拡張を実行
   * 「ん(n)」の次に子音が来て「やっぱり "nn" じゃないとダメだ！」となった時に、
   * 自分の入力履歴を強制的に "nn" に書き換える処理。
   */
  expandToDoubleN(): void {
    this.inputBuffer = "nn";
    this.typedLog.push({ char: "n", color: JUDGE_COLOR.CORRECT });
    this.isExpanded = true;
  }

  /**
   * ★追加メソッド4: nn拡張からのリセット（バックスペース用）
   * "nn" に拡張した後にバックスペースを押されたら、中途半端に "n" に戻すのではなく、
   * 一気に未入力状態（""）に戻す仕様。
   */
  tryShrinkFromDoubleN(): boolean {
    if (this.isExpanded && this.inputBuffer === "nn") {
      this.inputBuffer = ""; // 一気に消す
      this.typedLog = [];
      this.isExpanded = false;
      return true; // 戻す処理が成功したよ、と監督に伝える
    }
    return false;
  }

  /**
   * コア処理：ユーザーが打ったキーを受け取って、判定結果を返す
   */
  handleKey(key: string): string {
    let inputChar = key;
    const nextExpected = this.getCurrentChar();

    // 句読点のゆらぎ吸収（カンマでも読点として許容する親切設計）
    if (nextExpected === "、" && key === ",") inputChar = "、";
    if (nextExpected === "。" && key === ".") inputChar = "。";

    const nextBuffer = this.inputBuffer + inputChar;

    // startsWithで「このキーを受け入れた後も、まだ正解になれるパターンが残っているか？」を探す
    const hasFutureRoute = this.patterns.some((p) => p.startsWith(nextBuffer));

    // 正解ルートに乗っている場合
    if (hasFutureRoute) {
      this.inputBuffer = nextBuffer;
      this.typedLog.push({ char: inputChar, color: JUDGE_COLOR.CORRECT });

      // 打った結果、パターンと完全一致した（このブロックの入力が完了した）なら NEXT を返す
      if (this.patterns.includes(this.inputBuffer)) return "NEXT";
      return "OK"; // まだ途中なら OK
    }

    // --- ここから下はミス（ミスルート）の処理 ---

    // 既にこのブロックは完成しているのに、さらに余計なキーを打ってきた場合
    if (this.patterns.includes(this.inputBuffer)) {
      return "MISS";
    }

    // ガイド表示用の「本来打つべきだった文字」を特定する
    const currentPattern =
      this.patterns.find((p) => p.startsWith(this.inputBuffer)) ||
      this.patterns[0];
    const expectedChar = currentPattern[this.inputBuffer.length];

    // 何も期待されていない（想定外のバグ防止）
    if (!expectedChar) return "MISS";

    // ミスだけど、画面上では赤文字で進める（ゲームの仕様）
    this.inputBuffer += expectedChar;
    this.typedLog.push({ char: expectedChar, color: JUDGE_COLOR.MISS });

    // ミスタイプによって、偶然このブロックが完成してしまった場合
    if (this.patterns.includes(this.inputBuffer)) {
      return "MISS_NEXT";
    }

    return "MISS_ADVANCE"; // ミスして赤文字が進んだ状態
  }

  // バックスペース：1文字だけ履歴を消す
  backspace(): boolean {
    if (this.inputBuffer.length > 0) {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.typedLog.pop();
      return true;
    }
    return false; // もう消す文字がない
  }

  // このブロックの入力が完了しているか
  isDone() {
    return this.patterns.includes(this.inputBuffer);
  }
}

/**
 * 現場監督（TypingEngine クラス）
 * お題の文章を Segment（ブロック）に切り分け、キー入力を適切な Segment に割り振る
 */
export class TypingEngine {
  segments: Segment[]; // 文章を構成するブロックの配列
  segIndex: number; // 今、何番目のブロックを入力しているか（現在地）

  constructor(romaText: string) {
    this.segments = this.segmentize(romaText);
    this.segIndex = 0;
  }

  /**
   * 文章の解析・切り分け処理
   * 例：「かいしゃ」 -> ["か", "い", "しゃ"] というSegmentの配列に変換する
   */
  segmentize(roma: string): Segment[] {
    const out: Segment[] = [];
    let i = 0;
    while (i < roma.length) {
      // 現在地(i)から始まる文字が、辞書のキー（"sha"など）と一致するか長い順に探す
      const hitKey = SORTED_ROMA_KEYS.find((key) => roma.startsWith(key, i));
      if (hitKey) {
        out.push(new Segment(hitKey));
        i += hitKey.length; // 見つかった文字数分、現在地を進める
      } else {
        // 辞書にない記号などは、そのまま1文字のSegmentにするフォールバック処理
        out.push(new Segment(roma[i]));
        i++;
      }
    }
    return out;
  }

  /**
   * キーボードからの入力を受け付ける総合窓口
   */
  input(key: string): { status: string } {
    const segment = this.segments[this.segIndex]; // 今担当しているブロック
    const prevSegment = this.segments[this.segIndex - 1]; // 1つ前のブロック

    // --- 日本語タイピングの鬼門：「ん」の拡張チェック ---
    // 「ん」を "n" 1文字で済ませた直後に、母音(a,i,u,e,o)ではなく "n" が打たれた場合の処理
    if (key === "n" && this.segIndex > 0 && prevSegment) {
      // 1. まず、今のブロック（例："か"）が "n" を受け入れるか確認
      const isCorrectForCurrent = segment ? segment.canAccept(key) : false;

      // 2. 今のブロックは "n" なんて求めていない。
      // かつ、前のブロックが "n" 1文字で無理やり終わっている（「ん」の入力）場合
      if (!isCorrectForCurrent && prevSegment.isSingleN()) {
        prevSegment.expandToDoubleN(); // 前のブロックに「やっぱり "nn" にしといて！」と命令
        return { status: "EXPANDED" }; // 拡張成功として処理終了
      }
    }

    // もうすべての入力が終わっていたら何もしない
    if (!segment) return { status: "END" };

    // 今のブロックにキーを渡して、判定（正解？ミス？）してもらう
    const result = segment.handleKey(key);

    // そのブロックが完成した（NEXT）なら、監督の現在地（segIndex）を次に進める
    if (result === "NEXT" || result === "MISS_NEXT") {
      this.segIndex++;
      return { status: result };
    }

    // 完了していない場合は、判定結果をそのままコンポーネント側に伝える
    if (result === "MISS_ADVANCE") return { status: "MISS_ADVANCE" };
    if (result === "OK") return { status: "OK" };

    return { status: "MISS" };
  }

  /**
   * バックスペース（戻る）処理の総合窓口
   */
  backspace(): { status: string } {
    if (this.segments.length === 0) {
      this.segIndex = 0;
      return { status: "EMPTY" };
    }

    if (this.segIndex === 0 && this.segments[0].inputBuffer.length === 0) {
      return { status: "EMPTY" }; // 一番最初で未入力ならもう戻れない
    }

    // 現在地が最後尾をオーバーしていたら修正するガード処理
    if (this.segIndex >= this.segments.length) {
      this.segIndex = this.segments.length - 1;
    }

    let segment = this.segments[this.segIndex];

    // 今のブロックが未入力なら、1つ前のブロックに戻る（segIndexを戻す）
    if (segment.inputBuffer.length === 0 && this.segIndex > 0) {
      this.segIndex--;
      segment = this.segments[this.segIndex];
    }

    // 例外処理："nn" に拡張された「ん」なら、特殊な戻し方をする
    if (segment.tryShrinkFromDoubleN()) {
      return { status: "BACK_EXPANDED" };
    }

    // 通常のバックスペース処理
    segment.backspace();
    return { status: "BACK" };
  }

  // Reactコンポーネント（画面側）に、今の状態をまとめて渡すためのメソッド
  getDisplayState() {
    return {
      segments: this.segments,
      currentIndex: this.segIndex,
      isFinished: this.segIndex >= this.segments.length, // 全部終わったか
    };
  }
}