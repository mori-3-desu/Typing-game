import { describe, it, expect } from "vitest";
import { TypingEngine } from "../useTypingEngine";

describe("TypingEngine ロジックテスト", () => {
  // 単体入力のバックスペース
  it("基本: 入力途中でBSを押すと文字が消える", () => {
    const engine = new TypingEngine("ka");

    engine.input("k");
    expect(engine.segments[0].inputBuffer).toBe("k");

    engine.backspace();
    expect(engine.segments[0].inputBuffer).toBe(""); // 消えた

    expect(engine.input("k").status).toBe("OK"); // 再度打てる
  });

  // ■ ケース1: あん (an) - 救済モード
  it("あん(an): aでNEXT、nでNEXT。完了後のnで救済(EXPANDED)される", () => {
    const engine = new TypingEngine("an");

    // 1. "a" "n" -> NEXT
    expect(engine.input("a").status).toBe("NEXT");
    expect(engine.input("n").status).toBe("NEXT");

    // 2. 余分な "n" -> 救済発動 (Expanded)
    const result = engine.input("n");
    expect(result.status).toBe("EXPANDED");
    expect(engine.segments[1].inputBuffer).toBe("nn");

    // 3. BSで戻る -> 救済なので一気に消える ("")
    const bsResult = engine.backspace();
    expect(bsResult.status).toBe("BACK_EXPANDED");
    expect(engine.segments[1].inputBuffer).toBe("");
  });

  // ■ ケース2: 筋肉 (kinniku) - 必須モード
  it("筋肉(kinniku): 必須のnnの場合は、BSで1文字だけ消える", () => {
    const engine = new TypingEngine("kinniku");
    // "ki"
    engine.input("k");
    engine.input("i");
    // "n"
    engine.input("n");
    // "n" (必須の2文字目)
    const result = engine.input("n");
    expect(result.status).not.toBe("EXPANDED"); // 通常入力扱い

    // BS -> "n" が1つ消えて "n" になる
    engine.backspace();

    // 直前がExpandedでなければ、通常のBS動作（1文字削除）になっているか確認
    // "nn" から "n" を消したので、バッファは "n"
    expect(engine.segments[engine.segIndex].inputBuffer).toBe("n");
  });

  // ■ ケース3: 入力分岐BS
  it('入力分岐BS: "shi" ルートに入った後、BSで戻って "si" ルートで正解できる', () => {
    const engine = new TypingEngine("shi");

    // s -> h
    expect(engine.input("s").status).toBe("OK");
    expect(engine.input("h").status).toBe("OK");
    expect(engine.segments[0].inputBuffer).toBe("sh");

    // BS -> s に戻る
    engine.backspace();
    expect(engine.segments[0].inputBuffer).toBe("s");

    // i -> si で正解(NEXT)
    const result = engine.input("i");
    expect(result.status).toBe("NEXT");
    expect(engine.segments[0].inputBuffer).toBe("si");
  });

  // ■ ケース4: 複雑な分岐 (ちゃ)
  it('複雑な分岐BS: "cha" -> BS -> "tya" への変更', () => {
    const engine = new TypingEngine("cha");

    // c -> h
    engine.input("c");
    engine.input("h");

    // BS x 2 で最初に戻る
    engine.backspace(); // c
    engine.backspace(); // (空)

    // t -> y -> a で打ち直す
    expect(engine.input("t").status).toBe("OK");
    expect(engine.input("y").status).toBe("OK");
    expect(engine.input("a").status).toBe("NEXT");
  });
  
  it("セグメント下限ガード: インデックス0かつ空の状態でBSを連打しても、indexは0を維持しペナルティを返し続ける", () => {
    const engine = new TypingEngine("ringo");

    // 3回空振り
    engine.backspace();
    engine.backspace();
    const thirdResult = engine.backspace();

    // 1. ステータスは常にペナルティ
    expect(thirdResult.status).toBe("EMPTY");
    // 2. インデックスがマイナス（-1など）に突き抜けていないか
    expect(engine.segIndex).toBe(0); 
    // 3. 最初のセグメントが消滅していないか
    expect(engine.segments.length).toBeGreaterThan(0);
    // 4. 中身が空文字であること(変な文字やundefinedが入っていないか)
    expect(engine.segments[0].inputBuffer).toBe("");
  });
  it("空文字の単語: セグメントが0件でもBSがクラッシュせずEMPTYを返す", () => {
    const engine = new TypingEngine("");
    
    expect(engine.segments.length).toBe(0);
    expect(engine.backspace().status).toBe("EMPTY");
    expect(engine.segIndex).toBe(0);
  });
});
