/**
 * Cookie が発行されるかの単体テスト
 * 接続経路が正しければ発行されることを確認する
 *
 * - リクエストを送ったら Cookie が発行されて 204 が返ってくることを確認
 * - ネットワークエラーで落ちることを確認
 */

import { afterEach, describe, expect,it, vi } from "vitest";

import { ensureGuestSession } from "../ensureGuestSession";

afterEach(() => {
  vi.restoreAllMocks();
});

const NETWORK_ERROR_MESSAGE = "ネットワーク到達不能: ENETUNREACH";

describe("ensureGuestSession", () => {
  it("POSTしたらクッキーが発行されて204が返る事", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    
    await ensureGuestSession();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toMatch("auth/guest");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include")
  });

  it("ネットワークエラーで例外を投げる事", async ()=> {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error(NETWORK_ERROR_MESSAGE)
    )

    await expect(ensureGuestSession()).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  })
});
