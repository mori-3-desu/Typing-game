import { describe, it, expect } from "vitest";
import { buildHandoffCode, type HandoffData } from "./generateHandoffCode";

// 名前はゲームを開始すれば空文字が入らない設計
// またゲーム開始時は全部nullでそもそも生成されないのでテストには含めていない。
describe("buildHandoffCode", () => {
  it.each<{ name: string; input: HandoffData }>([
    {
      name: "正常なデータでコードを生成",
      input: { uuid: "abc123", refreshToken: "hitokage", name: "zenigame" },
    },
    {
      name: "日本語絵文字交じりでも生成可能",
      input: { uuid: "abc123", refreshToken: "negaigoto", name: "ジラーチ⭐" },
    },
  ])("$name", ({ input }) => {
    const code = buildHandoffCode(input);
    expect(code).toBeTruthy();
    expect(typeof code).toBe("string");
  });

  it.each<{ field: string; input: HandoffData }>([
    {
      field: "uuid",
      input: { uuid: null, refreshToken: "pokemonn", name: "kaio-ga" },
    },
    {
      field: "refreshToken",
      input: { uuid: "123-abc", refreshToken: null, name: "kaio-ga" },
    },
  ])("$fieldがnullならthrow", ({ input }) => {
    expect(() => buildHandoffCode(input)).toThrow(
      "引継ぎ可能なデータがありません"
    );
  });
});