/**
 * @file useTypingGame.ts
 * @description タイピングゲームのコアロジックを管理するカスタムフック
 * * NOTE: 本プロジェクトは、AIをメンターとして活用しながら開発を行わせていただきました。
 * コードの意図や技術選定の理由を明確にするため、また未来の自分への備忘録として、
 * あえて詳細にコメントを残しています。
 */
import { ROMA_VARIATIONS } from "../utils/romajiMap";
import { JUDGE_COLOR } from "../utils/setting";

// ★ クラスの外（または static プロパティ）で一度だけソートを済ませておく
// これにより、loadRandomWord が呼ばれるたびに実行されていた計算を 1回 に削減できます。
const SORTED_ROMA_KEYS = Object.keys(ROMA_VARIATIONS).sort(
  (a, b) => b.length - a.length,
);

// Segment クラス
export class Segment {
  canonical: string; // 基準となる正解パターン
  patterns: string[]; // 様々な正解ルート
  inputBuffer: string; // 現在入力されてるキーを保存
  typedLog: { char: string; color: string }[]; // 入力されたキーに対して正解なら緑、ミスなら赤
  isExpanded: boolean;

  // 単語とローマ字と入力された文字の初期化
  constructor(canonical: string) {
    this.canonical = canonical;
    this.patterns = ROMA_VARIATIONS[canonical] || [canonical];
    this.inputBuffer = "";
    this.typedLog = [];
    this.isExpanded = false;
  }

  // 現在の単語とローマ字と入力文字を表示
  get display() {
    if (this.inputBuffer === "") return this.patterns[0];
    // 入力バッファ（例: "sh"）に前方一致するパターンを配列の前から探す
    // ・入力が "s"  → "si" がヒット (siを表示)
    // ・入力が "sh" → "si" は不一致、"shi" がヒット (shiに表示が切り替わる！)
    const match = this.patterns.find((p) => p.startsWith(this.inputBuffer));
    return match ? match : this.patterns[0];
  }

  getCurrentChar() {
    const display = this.display;
    return display[this.inputBuffer.length] || "";
  }

  getRemaining() {
    const display = this.display;
    return display.slice(this.inputBuffer.length + 1);
  }

  handleKey(key: string): string {

    let inputChar = key;
    const nextExpected = this.getCurrentChar();

    // 句読点置換処理
    if (nextExpected === "、" && key === ",") inputChar = "、";
    else if (nextExpected === "。" && key === ".") inputChar = "。";

    const nextBuffer = this.inputBuffer + inputChar;
    const possibleRoutes = this.patterns.filter((p) =>
      p.startsWith(nextBuffer),
    );

    // 正解ルート
    if (possibleRoutes.length > 0) {
      this.inputBuffer = nextBuffer;
      this.typedLog.push({ char: inputChar, color: JUDGE_COLOR.CORRECT }); // 緑

      // 真偽値だけを知りたいならfindよりもincldesやsomeを使うほうが明確になる
      if (possibleRoutes.includes(this.inputBuffer)) return "NEXT";
      return "OK";
    }

    // --- B. ミスルート ---
    if (this.patterns.includes(this.inputBuffer)) {
      return "MISS";
    }

    // 正解ルートの先読み
    const currentPattern =
      this.patterns.find((p) => p.startsWith(this.inputBuffer)) ||
      this.patterns[0];
    const expectedChar = currentPattern[this.inputBuffer.length];

    if (!expectedChar) return "MISS";

    // 赤色進行
    this.inputBuffer += expectedChar;
    this.typedLog.push({ char: expectedChar, color: JUDGE_COLOR.MISS });

    if (this.patterns.includes(this.inputBuffer)) {
      return "MISS_NEXT"; // TypingGame側でミスしてたら次の単語に進めないようにする
    }

    return "MISS_ADVANCE"; // ミスタイプしても次に進める
  }

  // Backspace処理
  backspace(): boolean {
    if (this.inputBuffer.length > 0) {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.typedLog.pop();
      return true;
    }
    return false;
  }

  isDone() {
    return this.patterns.includes(this.inputBuffer); // 緑も消せる
  }
}

// TypingEngineクラス
export class TypingEngine {
  segments: Segment[];
  segIndex: number;

  //初期化
  constructor(romaText: string) {
    this.segments = this.segmentize(romaText); // 渡されたローマ字をセグメントに分解して保存
    this.segIndex = 0; // 今どこを打っているかをリセット
  }

  segmentize(roma: string): Segment[] {
    const out: Segment[] = [];
    let i = 0;
    // ここで入力分岐を判定

    // 前はここでオブジェクトを生成していて毎回新しい配列にしていたため計算量O(NlogN)になっていた。
    // アプリ起動時にソートを済ませ、結果を見るだけにしたことで単語数が増えても切り替え速度が落ちない。
    // ガベージコレクションの負担が減った。(古いメモリを捨てて領域を解放すること)
    // 分解の機能を持つ関数が、キーの並び替えという別の責任を負わなくて済むため、読みやすくなった。
    while (i < roma.length) {
      // startsWithでマッチするキーを探す(今はfindが優先らしい)
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

    // n拡張チェック
    if (key === "n" && this.segIndex > 0) {
      const prevSegment = this.segments[this.segIndex - 1];

      // nの特殊処理、nnでも行けるかを調べる。
      let isCorrectForCurrent = false;
      if (segment) {
        isCorrectForCurrent = segment.patterns.some((p) =>
          p.startsWith(segment.inputBuffer + key),
        ); // nを見つける(n、nnだったらn優先)
      }
      if (
        !isCorrectForCurrent &&
        prevSegment.canonical === "n" &&
        prevSegment.inputBuffer === "n"
      ) {
        // 必須じゃないところにnnが入力された
        prevSegment.inputBuffer = "nn";
        prevSegment.typedLog.push({ char: "n", color: JUDGE_COLOR.CORRECT }); // nnにして正解判定
        prevSegment.isExpanded = true; // Τ nn拡張専用のバックスペース処理で使うフラグ
        return { status: "EXPANDED" }; // 」
      }
    }

    // 一致しない場合はミス判定にし、次へ
    if (!segment) return { status: "END" };

    const result = segment.handleKey(key);

    if (result === "NEXT" || result === "MISS_NEXT") {
      this.segIndex++;
      return { status: result };
    }

    if (result === "MISS_ADVANCE") return { status: "MISS_ADVANCE" };
    if (result === "OK") return { status: "OK" };

    return { status: "MISS" };
  }

  // nn拡張際も含めたBackspace処理
  backspace(): { status: string } {
    // 文字が打たれてないか先頭の場合で戻れないときは何もしない(状態EMPTYを付与)
    if (
      this.segIndex === 0 &&
      this.segments[0].inputBuffer.length === 0
    ) {
      return { status: "EMPTY" };
    }
    
    if (this.segIndex >= this.segments.length) {
      this.segIndex = this.segments.length - 1;
    }

    let segment = this.segments[this.segIndex];

    if (segment.inputBuffer.length === 0 && this.segIndex > 0) {
      this.segIndex--;
      segment = this.segments[this.segIndex];
    }

    if (segment.isExpanded && segment.inputBuffer === "nn") {
      segment.inputBuffer = ""; // nn拡張なら一気に消す(ここは試験的実装なのでnに変える可能性あり)
      segment.typedLog = [];
      segment.isExpanded = false; // 拡張フラグを元に戻す
      return { status: "BACK_EXPANDED" }; // 戻したよのステータス
    }

    segment.backspace();

    // 戻した結果、まだ完了状態なら（あまりないケースだが）戻す？
    // 基本的には文字を消すだけ
    return { status: "BACK" };
  }

  // Displayに現在進行形で反映
  getDisplayState() {
    return {
      segments: this.segments,
      currentIndex: this.segIndex,
      isFinished: this.segIndex >= this.segments.length,
    };
  }
}
