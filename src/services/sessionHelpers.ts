import { supabase } from "../supabase";

export const requireSession = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("認証セッションが見つかりません。再度ログインしてください。");
  }
  return session;
};
