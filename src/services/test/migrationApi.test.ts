import { afterEach, describe, expect, it, vi } from "vitest";

import { importByCode, issueMigrationCode } from "../migrationApi";

const NETWORK_ERROR_MESSAGE = "ネットワーク到達不能: ENETUNREACH";
const REQUEST_CODE = "ABCDEF2345";

const mockNetworkError = () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error(NETWORK_ERROR_MESSAGE),
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("issueMigrationCode", () => {
  it("200を受け取ったら code を返すこと", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: REQUEST_CODE,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await issueMigrationCode();

    expect(result).toEqual({
      code: REQUEST_CODE,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toMatch("/api/migration/code");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
  });

  it("code が欠落していたらthrowすること", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ng: "no code field",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(issueMigrationCode()).rejects.toThrow();
  });

  it("fetchがrejectしてネットワークエラーを返すこと", async () => {
    mockNetworkError();
    await expect(issueMigrationCode()).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  });
});

describe("importByCode", () => {
  const INHERITED_NAME = "小豆沢こはね";
  const SERVER_MESSAGE = "不正なコードです";

  it("200を受け取ったら code を Body に含めて POST し、 name を返すこと", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: INHERITED_NAME,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await importByCode(REQUEST_CODE);

    expect(result).toEqual({
      name: INHERITED_NAME,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const sentHeaders = new Headers(init?.headers);
    expect(url).toMatch("api/migration/import");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(sentHeaders.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ code: REQUEST_CODE });
  });

  it("レスポンスが name フィールドを持たない場合 throw されること", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ng: "data",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(importByCode(REQUEST_CODE)).rejects.toThrow();
  });

  it("コードの検証が失敗した時、エラーを返すこと", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message: SERVER_MESSAGE,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(importByCode(REQUEST_CODE)).rejects.toThrow(SERVER_MESSAGE);
  });

  it("fetchがrejectしてネットワークエラーを返すこと", async () => {
    mockNetworkError();

    await expect(importByCode(REQUEST_CODE)).rejects.toThrow(
      NETWORK_ERROR_MESSAGE,
    );
  });
});
