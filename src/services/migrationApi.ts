import { API_BASE } from "./apiBase";

export type MigrationResponse = {
  readonly code: string;
  readonly expires_at: string;
};

export type ImportNameResponse = {
  readonly name: string;
};

const isImportNameResponse = (value: unknown): value is ImportNameResponse => {
  if (typeof value !== "object" || value === null) return false;

  return "name" in value && typeof value.name === "string";
};

const isMigrationResponse = (value: unknown): value is MigrationResponse => {
  if (typeof value !== "object" || value === null) return false;

  return (
    "code" in value &&
    typeof value.code === "string" &&
    "expires_at" in value &&
    typeof value.expires_at === "string"
  );
};

/**
 * response.ok を確認し、失敗時は body.message または fallback を投げる。
 * 成功時は body を消費しないため、呼び出し側で再度 .json() を呼べる。
 * services/apiHelpers.ts に抽出候補(3 箇所目: database.ts:updateUserName)
 */
const assertOkOrThrow = async (
  response: Response,
  fallbackMessage: string,
): Promise<void> => {
  if (response.ok) return;

  const body = await response.json().catch(() => ({}));
  throw new Error(body.message ?? fallbackMessage);
};

const parseAndValidate = async <T>(
  response: Response,
  guard: (value: unknown) => value is T,
  errorMessage: string,
): Promise<T> => {
  const data: unknown = await response.json();

  if (!guard(data)) {
    throw new Error(errorMessage);
  }

  return data;
};

export const issueMigrationCode = async (
  accessToken: string,
): Promise<MigrationResponse> => {
  const response = await fetch(`${API_BASE}/api/migration/code`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  await assertOkOrThrow(response, "引継ぎコードの発行に失敗しました");

  return parseAndValidate(
    response,
    isMigrationResponse,
    "[migrationApi]: 引継ぎコードのレスポンス形式が不正です",
  );
};

export const importByCode = async (
  accessToken: string,
  code: string,
): Promise<ImportNameResponse> => {
  const response = await fetch(`${API_BASE}/api/migration/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ code }),
  });

  await assertOkOrThrow(response, "コード検証に失敗しました");
  return parseAndValidate(
    response,
    isImportNameResponse,
    "[migrationApi]: 想定外のレスポンスの形式が受信されました",
  );
};
