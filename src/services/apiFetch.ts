// X-XSRF_TOKENを取得する正規表現で取得する関数
// match[0]は先頭または;スペース後にマッチする値。; XSRF～ ;前まで

import { ensureGuestSession } from "./ensureGuestSession";

// ()で値取得をしている。まず全体抜き取った後に()の部分を配列で取得している。
const getXsrfToken = () => {
  const match = document.cookie.match(/(^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[2]) : null;
};

const DEFAULT_METHODS = "GET";
const MUTABLE_METHODS = ["POST", "PATCH"];

export const apiFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  retryCount = 0,
): Promise<Response> => {
  const method = init?.method?.toUpperCase() ?? DEFAULT_METHODS;
  const headers = new Headers(init?.headers);
  const xsrfToken = getXsrfToken();

  //状態変化にXSRFを付与
  if (MUTABLE_METHODS.includes(method) && xsrfToken) {
    headers.set("X-XSRF-TOKEN", xsrfToken);
  }

  const fetchOptions: RequestInit = {
    ...init,
    headers,
    credentials: "include",
  };

  // fetchのラッパー。401の際のみ一回だけ再取得している
  // それ以外は呼び出しもとで処理する。
  const response = await fetch(input, fetchOptions);

  if (response.status === 401 && retryCount < 1) {
    await ensureGuestSession();
    const retryResponse = await apiFetch(input, init, retryCount + 1);

    return retryResponse;
  }

  return response;
};
