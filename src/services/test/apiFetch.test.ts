import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../apiFetch";
import * as guestSession from "../ensureGuestSession";

afterEach(() => {
  vi.restoreAllMocks();
});

const input = "http://example.com";
const LOWERCASE_METHODS = ["post", "patch"];
const MUTABLE_METHODS = ["POST", "PATCH"];
const expectedCredentials = { credentials: "include" };
const xsrfToken = "abcdfc-123";

const testStatus = [200, 400, 404, 500];
const okResponse = new Response(null, { status: 200 });
const unAuthResponse = new Response(null, { status: 401 });

describe("apiFetch", () => {
  it("どのリクエストにも credentials: include がつく", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse);

    const response = await apiFetch(input);
    expect(response).toBe(okResponse);

    expect(fetchSpy).toHaveBeenCalledWith(
      input,
      expect.objectContaining(expectedCredentials),
    );
  });

  it.each(MUTABLE_METHODS)(
    "%s: XSRF Cookie があるとき、X-XSRF-TOKEN にその値が入る",
    async (method) => {
      vi.spyOn(document, "cookie", "get").mockReturnValue(
        `XSRF-TOKEN=${xsrfToken}`,
      );

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(okResponse);

      const response = await apiFetch(input, { method });
      expect(response).toBe(okResponse);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(input);
      const sendHeaders = new Headers(init?.headers);
      expect(init?.method).toBe(method);
      expect(sendHeaders.get("X-XSRF-TOKEN")).toBe(xsrfToken);
    },
  );

  // methodを明示しない場合は自動でGETになる挙動も確認。
  it.each([undefined, "GET"])(
    "%s: では Cookie があっても XSRF をつけない",
    async (method) => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(okResponse);

      vi.spyOn(document, "cookie", "get").mockReturnValue(
        `XSRF-TOKEN=${xsrfToken}`,
      );

      const response = await apiFetch(input, { method });
      expect(response).toBe(okResponse);

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(input);

      const sendHeaders = new Headers(init?.headers);
      expect(sendHeaders.get("X-XSRF-TOKEN")).toBeNull();
    },
  );

  it.each(MUTABLE_METHODS)(
    "%s: でも Cookie が無いときは XSRF をつけない",
    async (method) => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(okResponse);

      vi.spyOn(document, "cookie", "get").mockReturnValue("");

      const response = await apiFetch(input, { method });
      expect(response).toBe(okResponse);

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(input);

      const sendHeaders = new Headers(init?.headers);
      expect(init?.method).toBe(method);
      expect(sendHeaders.get("X-XSRF-TOKEN")).toBeNull();
    },
  );

  it.each(LOWERCASE_METHODS)(
    "%s: 小文字メソッドでもXSRFが付与される",
    async (method) => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(okResponse);
      vi.spyOn(document, "cookie", "get").mockReturnValue(
        `XSRF-TOKEN=${xsrfToken}`,
      );

      const response = await apiFetch(input, { method });
      expect(response).toBe(okResponse);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];

      expect(url).toBe(input);
      expect(init?.method).toBe(method);

      const sendHeaders = new Headers(init?.headers);
      expect(sendHeaders.get("X-XSRF-TOKEN")).toBe(xsrfToken);
    },
  );

  it.each(MUTABLE_METHODS)(
    "%s: 呼び出し側が渡したヘッダは保持され、そこに XSRF が追加される",
    async (method) => {
      const customResponse = new Response(null, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(customResponse);

      vi.spyOn(document, "cookie", "get").mockReturnValue(
        `XSRF-TOKEN=${xsrfToken}`,
      );

      const response = await apiFetch(input, {
        method,
        headers: { "Content-Type": "application/json" },
      });

      expect(response).toBe(customResponse);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];

      expect(url).toBe(input);
      expect(init?.method).toBe(method);
      const sendHeaders = new Headers(init?.headers);

      expect(sendHeaders.get("Content-Type")).toBe("application/json");
      expect(sendHeaders.get("X-XSRF-TOKEN")).toBe(xsrfToken);
    },
  );

  it("401 が返ったら ensureGuestSession を呼び、一回だけ再試行して、再施行後のレスポンスを返す", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unAuthResponse)
      .mockResolvedValue(okResponse);

    const ensureGuestSessionSpy = vi
      .spyOn(guestSession, "ensureGuestSession")
      .mockResolvedValue();

    const response = await apiFetch(input);

    expect(ensureGuestSessionSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    expect(response).toBe(okResponse);
  });

  it("再試行でも 401 が返ったらそれ以上はリトライしない。401 のレスポンスを返す", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(unAuthResponse);

    const ensureGuestSessionSpy = vi
      .spyOn(guestSession, "ensureGuestSession")
      .mockResolvedValue();

    const response = await apiFetch(input);
    
    expect(ensureGuestSessionSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    expect(response).toBe(unAuthResponse);
  });

  it.each(testStatus)(
    "401 以外はそのまま返し、%d はensureGuestSession を呼ばない。",
    async (notUnAuthStatus) => {
      const mockResponse = new Response(null, { status: notUnAuthStatus });
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse);

      const ensureGuestSessionSpy = vi
        .spyOn(guestSession, "ensureGuestSession")
        .mockResolvedValue();

      const response = await apiFetch(input);

      expect(ensureGuestSessionSpy).toHaveBeenCalledTimes(0);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(response).toBe(mockResponse);
      expect(response.status).toBe(notUnAuthStatus);
    },
  );
});
