import { API_BASE } from "./apiBase";

export const ensureGuestSession = async (): Promise<void> => {
  const response = await fetch(`${API_BASE}/auth/guest`, {
    method: "POST",
    credentials: "include",
  });

  if (response.status !== 204) {
    throw new Error(
      `ゲストセッションの発行に失敗 (status: ${response.status})`,
    );
  }
};
