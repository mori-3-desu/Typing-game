import { afterEach, describe, expect, it, vi } from "vitest";

import { importByCode, issueMigrationCode } from "./migrationApi";

const NETWORK_ERROR_MESSAGE = "ネットワーク到達不能: ENETUNREACH";
const REQUEST_CODE = "ABCDEF2345";
const DUMMY_JWT = "dummy_jwt";

const mockNetworkError = () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error(NETWORK_ERROR_MESSAGE),
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("issueMigrationCode", () => {
  const SERVER_MESSAGE = "認証に失敗しました";

  it("200を受け取ったら code と expiredAt を返すこと", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: REQUEST_CODE,
          expires_at: "2026-05-23T12:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await issueMigrationCode(DUMMY_JWT);

    expect(result).toEqual({
      code: REQUEST_CODE,
      expires_at: "2026-05-23T12:00:00Z",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toMatch("/api/migration/code");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${DUMMY_JWT}` });
  });

  it("code と expires_at 片方が欠落していたらthrowすること", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          expires_at: "2026-05-23T12:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(issueMigrationCode(DUMMY_JWT)).rejects.toThrow();
  });

  it("認証が失敗したらエラーレスポンスが返る事", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: SERVER_MESSAGE }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(issueMigrationCode(DUMMY_JWT)).rejects.toThrow(
      SERVER_MESSAGE,
    );
  });

  it("fetchがrejectしてネットワークエラーを返すこと", async () => {
    mockNetworkError();
    await expect(issueMigrationCode(DUMMY_JWT)).rejects.toThrow(
      NETWORK_ERROR_MESSAGE,
    );
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
    const result = await importByCode(DUMMY_JWT, REQUEST_CODE);

    expect(result).toEqual({
      name: INHERITED_NAME,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toMatch("api/migration/import");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${DUMMY_JWT}` });
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

    await expect(importByCode(DUMMY_JWT, REQUEST_CODE)).rejects.toThrow();
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

    await expect(importByCode(DUMMY_JWT, REQUEST_CODE)).rejects.toThrow(
      SERVER_MESSAGE,
    );
  });

  it("fetchがrejectしてネットワークエラーを返すこと", async () => {
    mockNetworkError();

    await expect(importByCode(DUMMY_JWT, REQUEST_CODE)).rejects.toThrow(
      NETWORK_ERROR_MESSAGE,
    );
  });
});
