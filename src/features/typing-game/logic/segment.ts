import { JUDGE_COLOR } from "../../../utils/constants";
import { ROMA_VARIATIONS } from "../utils/romajiMap";

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

  constructor(canonical: string, isEnglish: boolean = false) {
    this.canonical = canonical;

    // EXTRAモードなら辞書を引かずにその文字だけを正解にする
    const initialPatterns = isEnglish
      ? [canonical]
      : ROMA_VARIATIONS[canonical] || [canonical];

    this.patterns = initialPatterns;
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
   * 試し打ちチェック
   * 状態（buffer）は変更せずに、「もしこのキーが来たら正解ルートに乗れるか？」だけを判定する
   */
  canAccept(key: string): boolean {
    return this.patterns.some((p) => p.startsWith(this.inputBuffer + key));
  }

  /**
   * : n単体かどうかチェック
   * 「ん」を "n" 1文字で済ませた状態かどうか。（次の文字の判定に使う）
   */
  isSingleN(): boolean {
    return this.canonical === "n" && this.inputBuffer === "n";
  }

  /**
   * : nnへの拡張を実行
   * 「ん(n)」の次に子音が来て「やっぱり "nn" じゃないとダメだ！」となった時に、
   * 自分の入力履歴を強制的に "nn" に書き換える処理。
   */
  expandToDoubleN(): void {
    this.inputBuffer = "nn";
    this.typedLog.push({ char: "n", color: JUDGE_COLOR.CORRECT });
    this.isExpanded = true;
  }

  /**
   * nn拡張からのリセット（バックスペース用）
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
    // 生のキー入力でルートチェック
    // ※先にすり替えると "kyo" に "c" が通過してしまうバグの原因になる
    const nextBuffer = this.inputBuffer + key;
    const hasFutureRoute = this.patterns.some((p) => p.startsWith(nextBuffer));

    // handlekeyは正解時とミス時で振り分けるだけ
    return hasFutureRoute ? this.accept(key) : this.advanceOnMiss();
  }

  // handleKeyを通じてのみ行われる処理のため、
  // 外部から呼ばれると壊れる可能性があるため、プライベートメソッドを使用
  private accept(key: string): "NEXT" | "OK" {
    this.inputBuffer += key;
    this.typedLog.push({ char: key, color: JUDGE_COLOR.CORRECT });
    return this.isDone() ? "NEXT" : "OK";
  }

  private advanceOnMiss(): "MISS" | "MISS_NEXT" | "MISS_ADVANCE" {
    if (this.isDone()) return "MISS";
    const currentPattern =
      this.patterns.find((p) => p.startsWith(this.inputBuffer)) ??
      this.patterns[0];
    const expectedChar = currentPattern[this.inputBuffer.length];

    // 何も期待されていない（想定外のバグ防止）
    if (!expectedChar) return "MISS";
    // ミスだけど、画面上では赤文字で進める（ゲームの仕様）
    this.inputBuffer += expectedChar;
    this.typedLog.push({ char: expectedChar, color: JUDGE_COLOR.MISS });
    return this.isDone() ? "MISS_NEXT" : "MISS_ADVANCE";
  }

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