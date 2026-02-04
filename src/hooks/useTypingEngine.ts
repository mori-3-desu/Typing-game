/**
 * @file useTypingGame.ts
 * @description タイピングゲームのコアロジック
 */
import { ROMA_VARIATIONS } from "../utils/romajiMap";
import { JUDGE_COLOR } from "../utils/setting";

// 静的ソート（アプリ起動時に1回だけ実行）
const SORTED_ROMA_KEYS = Object.keys(ROMA_VARIATIONS).sort(
  (a, b) => b.length - a.length,
);

// Segment クラス
export class Segment {
  canonical: string;
  patterns: string[];
  inputBuffer: string;
  typedLog: { char: string; color: string }[];
  isExpanded: boolean;

  constructor(canonical: string) {
    this.canonical = canonical;
    this.patterns = ROMA_VARIATIONS[canonical] || [canonical];
    this.inputBuffer = "";
    this.typedLog = [];
    this.isExpanded = false;
  }

  get display() {
    if (this.inputBuffer === "") return this.patterns[0];
    const match = this.patterns.find((p) => p.startsWith(this.inputBuffer));
    return match ? match : this.patterns[0];
  }

  getCurrentChar() {
    return this.display[this.inputBuffer.length] || "";
  }

  getRemaining() {
    return this.display.slice(this.inputBuffer.length + 1);
  }

  /**
   * ★追加メソッド1: 試し打ちチェック
   * 状態を変更せずに「このキーを受け入れられるか？」だけを答える
   */
  canAccept(key: string): boolean {
    return this.patterns.some((p) => p.startsWith(this.inputBuffer + key));
  }

  /**
   * ★追加メソッド2: n単体かどうかチェック
   * 親クラスが this.canonical === "n" とか調べるのを防ぐ
   */
  isSingleN(): boolean {
    return this.canonical === "n" && this.inputBuffer === "n";
  }

  /**
   * ★追加メソッド3: nnへの拡張を実行
   * 状態変更（ログ追加など）の責任をここに集約
   */
  expandToDoubleN(): void {
    this.inputBuffer = "nn";
    this.typedLog.push({ char: "n", color: JUDGE_COLOR.CORRECT });
    this.isExpanded = true;
  }

  /**
   * ★追加メソッド4: nn拡張からのリセット（バックスペース用）
   * 戻せた場合はtrue、戻せなかったらfalseを返す
   */
  tryShrinkFromDoubleN(): boolean {
    if (this.isExpanded && this.inputBuffer === "nn") {
      this.inputBuffer = ""; // 一気に消す仕様
      this.typedLog = [];
      this.isExpanded = false;
      return true;
    }
    return false;
  }

  handleKey(key: string): string {
    let inputChar = key;
    const nextExpected = this.getCurrentChar();

    // 句読点置換
    if (nextExpected === "、" && key === ",") inputChar = "、";
    if (nextExpected === "。" && key === ".") inputChar = "。";

    const nextBuffer = this.inputBuffer + inputChar;
    
    // 変数名を分かりやすく、ロジックをシンプルに
    // startsWithで「未来があるルート」を探す
    const hasFutureRoute = this.patterns.some((p) => p.startsWith(nextBuffer));

    // 正解ルート
    if (hasFutureRoute) {
      this.inputBuffer = nextBuffer;
      this.typedLog.push({ char: inputChar, color: JUDGE_COLOR.CORRECT });

      // 正解確定（そのパターンと完全一致）ならNEXT
      if (this.patterns.includes(this.inputBuffer)) return "NEXT";
      return "OK";
    }

    // --- ミスルート処理 ---
    
    // 既に入力が終わってるのに余計な入力をした
    if (this.patterns.includes(this.inputBuffer)) {
      return "MISS";
    }

    // 正解ルートの先読み（ガイド表示用）
    const currentPattern =
      this.patterns.find((p) => p.startsWith(this.inputBuffer)) ||
      this.patterns[0];
    const expectedChar = currentPattern[this.inputBuffer.length];

    if (!expectedChar) return "MISS";

    // 赤色進行
    this.inputBuffer += expectedChar;
    this.typedLog.push({ char: expectedChar, color: JUDGE_COLOR.MISS });

    // ミスタイプで単語が完成してしまった場合（次の単語に行かせない）
    if (this.patterns.includes(this.inputBuffer)) {
      return "MISS_NEXT";
    }

    return "MISS_ADVANCE";
  }

  backspace(): boolean {
    if (this.inputBuffer.length > 0) {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.typedLog.pop();
      return true;
    }
    return false;
  }

  isDone() {
    return this.patterns.includes(this.inputBuffer);
  }
}

// TypingEngineクラス
export class TypingEngine {
  segments: Segment[];
  segIndex: number;

  constructor(romaText: string) {
    this.segments = this.segmentize(romaText);
    this.segIndex = 0;
  }

  segmentize(roma: string): Segment[] {
    const out: Segment[] = [];
    let i = 0;
    while (i < roma.length) {
      const hitKey = SORTED_ROMA_KEYS.find((key) => roma.startsWith(key, i));
      if (hitKey) {
        out.push(new Segment(hitKey));
        i += hitKey.length;
      } else {
        out.push(new Segment(roma[i]));
        i++;
      }
    }
    return out;
  }

  // 入力処理
  input(key: string): { status: string } {
    const segment = this.segments[this.segIndex];
    const prevSegment = this.segments[this.segIndex - 1];

    // n拡張チェック
    // 親クラスは「条件を確認して、命令する」だけ。中身はいじらない。
    if (key === "n" && this.segIndex > 0 && prevSegment) {
      
      // 1. 現在のセグメントがこのキーを受け入れるか？（segmentが無い＝最後の文字後の入力などの場合はfalse）
      const isCorrectForCurrent = segment ? segment.canAccept(key) : false;

      // 2. 受け入れられず、かつ前の文字が「n」単体で終わっているなら拡張
      if (!isCorrectForCurrent && prevSegment.isSingleN()) {
        prevSegment.expandToDoubleN(); // 命令！
        return { status: "EXPANDED" };
      }
    }

    if (!segment) return { status: "END" };

    const result = segment.handleKey(key);

    if (result === "NEXT" || result === "MISS_NEXT") {
      this.segIndex++;
      return { status: result };
    }

    // オブジェクトリテラルの省略記法を使えば return { status: result } だけで済む場合もありますが、
    // 明示的なマッピングを残すのも安全です。
    if (result === "MISS_ADVANCE") return { status: "MISS_ADVANCE" };
    if (result === "OK") return { status: "OK" };

    return { status: "MISS" };
  }

  // Backspace処理
  backspace(): { status: string } {
    if (
      this.segIndex === 0 &&
      this.segments[0].inputBuffer.length === 0
    ) {
      return { status: "EMPTY" };
    }

    // 範囲外ガード
    if (this.segIndex >= this.segments.length) {
      this.segIndex = this.segments.length - 1;
    }

    let segment = this.segments[this.segIndex];

    // 今のセグメントが空なら、前のセグメントに戻る
    if (segment.inputBuffer.length === 0 && this.segIndex > 0) {
      this.segIndex--;
      segment = this.segments[this.segIndex];
    }

    // nn拡張のリセット処理
    // Segment側に「戻せるなら戻して！」と依頼し、成功したらステータスを返す
    if (segment.tryShrinkFromDoubleN()) {
      return { status: "BACK_EXPANDED" };
    }

    // 通常のバックスペース
    segment.backspace();
    return { status: "BACK" };
  }

  getDisplayState() {
    return {
      segments: this.segments,
      currentIndex: this.segIndex,
      isFinished: this.segIndex >= this.segments.length,
    };
  }
}