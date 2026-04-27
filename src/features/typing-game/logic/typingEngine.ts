/**
 * @file typingEngine.ts
 * @description タイピングゲームのコアロジック（UIを持たない純粋な頭脳）
 * * 【全体の設計思想】
 * - Segment: 「しゃ」や「か」など、1つのまとまり（ブロック）を担当する「現場の作業員」
 * - TypingEngine: 文章全体を管理し、どの作業員にキーを渡すか指示する「現場監督」
 */

import { ROMA_VARIATIONS } from "../utils/romajiMap";
import { Segment } from "./segment";

// 静的ソート（アプリ起動時に1回だけ実行）
// 長い文字（"shi" など）から先にマッチさせるため、文字数の多い順にソートしておく
const SORTED_ROMA_KEYS = Object.keys(ROMA_VARIATIONS).sort(
  (a, b) => b.length - a.length,
);

/**
 * 現場監督（TypingEngine クラス）
 * お題の文章を Segment（ブロック）に切り分け、キー入力を適切な Segment に割り振る
 */
export class TypingEngine {
  private isEnglish: boolean; // 英語モードかローマ字か
  segments: Segment[]; // 文章を構成するブロックの配列
  segIndex: number; // 今、何番目のブロックを入力しているか（現在地）

  constructor(romaText: string, isEnglish: boolean = false) {
    this.isEnglish = isEnglish;
    this.segments = this.segmentize(romaText);
    this.segIndex = 0;
  }

  private segmentizeRoma(roma: string): Segment[] {
    const out: Segment[] = [];

    for (let i = 0; i < roma.length; ) {
      // 現在地(i)から始まる文字が、辞書のキー（"sha"など）と一致するか長い順に探す
      // 辞書にない記号などは、そのまま1文字のSegmentにするフォールバック処理
      const hitKey = SORTED_ROMA_KEYS.find((key) => roma.startsWith(key, i));
      if (!hitKey) {
        out.push(new Segment(roma[i]));
        i++;
        continue;
      }

      out.push(new Segment(hitKey));
      i += hitKey.length;
    }

    return out;
  }

  /**
   * 文章の解析・切り分け処理
   *
   * @param roma 解析対象のローマ字（例: "kaisha"）
   * @returns Segmentの配列（例: "kaisha" → ["ka", "i", "sha"]）
   */
  segmentize(roma: string): Segment[] {
    // 英単語モードなら即座に変換して返す
    if (this.isEnglish) {
      return [...roma].map((c) => new Segment(c, true));
    }

    return this.segmentizeRoma(roma);
  }

  /**
   * キーボードからの入力を受け付ける総合窓口
   * todo: 「ん」の特殊処理が Engine 側に混在している。Segment 側で解決できないか検討したい
   */
  input(key: string): { status: string } {
    const segment = this.segments[this.segIndex]; // 今担当しているブロック
    const prevSegment = this.segments[this.segIndex - 1]; // 1つ前のブロック

    // EXTRAはn分岐をさせない
    if (!this.isEnglish) {
      // --- 日本語タイピングの鬼門：「ん」の拡張チェック ---
      // 「ん」を "n" 1文字で済ませた直後に、母音(a,i,u,e,o)ではなく "n" が打たれた場合の処理
      if (key === "n" && this.segIndex > 0 && prevSegment) {
        // 1. まず、今のブロック（例："か"）が "n" を受け入れるか確認
        const isCorrectForCurrent = segment?.canAccept(key) ?? false;

        // 2. 今のブロックは "n" なんて求めていない。
        // かつ、前のブロックが "n" 1文字で無理やり終わっている（「ん」の入力）場合
        if (!isCorrectForCurrent && prevSegment.isSingleN()) {
          prevSegment.expandToDoubleN(); // 前のブロックに「やっぱり "nn" にしといて！」と命令
          return { status: "EXPANDED" }; // 拡張成功として処理終了
        }
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
