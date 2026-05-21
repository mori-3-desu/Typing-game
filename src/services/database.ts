import { supabase } from "../supabase";
import {
  type DifficultyLevel,
  type MutableWordDataMap,
  type RankingScore,
  type ScoreRequestBody,
  type WordRow,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL;

// 🛡️ 型ガード関数（Type Guard）
// 文字列が本当に "EASY" | "NORMAL" | "HARD" | "EXTRA"のいずれかかチェックする守衛さん
// これを通れば、TypeScriptは安心して DifficultyLevel 型として扱ってくれます
function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return (
    typeof value === "string" &&
    ["EASY", "NORMAL", "HARD", "EXTRA"].includes(value)
  );
}

export const DatabaseService = {
  /**
   * ゲーム開始時に必要な単語データを取得
   * 取得したデータが正しい形式かチェックしながら格納します
   * （NGワードはサーバー側に集約。/api/user/name/validate で検証する）
   */
  async fetchAllGameData() {
    // 1. 単語データの取得
    const { data: wordsData, error: wordsError } = await supabase
      .from("words")
      .select("jp, roma, difficulty");
    if (wordsError) throw wordsError;

    // データが空っぽだとゲームがクラッシュするので防衛
    if (!wordsData || wordsData.length === 0) {
      throw new Error("DBから単語データを取得できませんでした。");
    }

    // 3. データの整形とバリデーション
    const formattedData: MutableWordDataMap = {
      EASY: [],
      NORMAL: [],
      HARD: [],
      EXTRA: [],
    };

    wordsData?.forEach((row: WordRow) => {
      if (!row.difficulty) return;

      const cleanJp = row.jp?.trim();
      const cleanRoma = row.roma?.trim();
      if (!cleanJp || !cleanRoma) {
        console.warn("空のJP、または空のROMAを検出しました", row);
        return;
      }
      // 1. まず掃除だけする（まだ型は string のまま！）
      // ※ ここで 'as DifficultyLevel' は書かないのが作法です
      const cleanLevel = row.difficulty.trim().toUpperCase();

      if (!isDifficultyLevel(cleanLevel)) {
        console.warn(`[Data Skip] 未知のデータ: ${row.difficulty}`);
        return;
      }

      formattedData[cleanLevel].push({ jp: cleanJp, roma: cleanRoma });
    });

    return {
      formattedData,
    };
  },

  /**
   * スコア送信（POST /api/scores）
   * JWTをAuthorizationヘッダーに付けてSpring Boot APIに送信
   * サーバー側でハイスコア判定・upsertを行う
   */
  async postScore(body: ScoreRequestBody): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("未ログイン状態ではスコアを送信できません");
    }

    const response = await fetch(`${API_BASE}/api/scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Score POST failed: ${response.status}`);
    }
  },

  /**
   * 内部用：スコア取得の共通ロジック
   * ランキング取得と開発者スコア取得でコードを重複させないための共通化
   * @param difficulty 取得したい難易度
   * @param isCreator 開発者フラグ（trueなら開発者のみ、falseなら一般ユーザーのみ）
   * @param limit 取得件数
   */
  async getScores(
    difficulty: DifficultyLevel,
    isCreator: boolean,
    signal?: AbortSignal,
  ): Promise<RankingScore[]> {
    const response = await fetch(
      `${API_BASE}/api/scores/ranking/${difficulty}?creator=${isCreator}`,
      { signal },
    );

    if (!response.ok) {
      throw new Error(`HTTP error status: ${response.status}`);
    }

    return (await response.json()) as RankingScore[];
  },
  
  /**
   * 全国ランキングを取得
   * 共通ロジック(getScores)を呼び出すだけ
   */
  async getRanking(
    difficulty: DifficultyLevel,
    signal?: AbortSignal,
  ): Promise<RankingScore[]> {
    return this.getScores(difficulty, false, signal);
  },

  /**
   * 開発者スコアを取得
   * 共通ロジック(getScores)を呼び出すだけ
   */
  async getDevScore(
    difficulty: DifficultyLevel,
    signal?: AbortSignal,
  ): Promise<RankingScore[]> {
    return this.getScores(difficulty, true, signal);
  },

  async requireSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("未ログイン状態では名前を更新出来ません");
    }
    return session;
  },

  /**
   * ユーザー名の登録
   * DBの登録ではないため、ここでは検証が成功したら200を返す
   */
  async validateUserName(initialName: string): Promise<boolean> {
    const session = await this.requireSession();
    
    const response = await fetch(`${API_BASE}/api/user/name/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      // バックエンドの NameValidationRequest は name フィールドを期待する
      body: JSON.stringify({ name: initialName }),
    });

    if (!response.ok) {
      throw new Error(`name validate failed: ${response.status}`);
    }

    const result = (await response.json()) as { valid: boolean };
    return result.valid;
  },

  /**
   * ユーザー名の更新
   * 名前だけを変更したい場合に使用
   */
  async updateUserName(newName: string): Promise<void> {
    const session = await this.requireSession();

    const response = await fetch(`${API_BASE}/api/scores/name`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name: newName }),
    });

    if (!response.ok) {
      // サーバーの ApiErrorResponse.message を拾う(NG時は「この名前は使用できません」)。
      // 呼び出し側はこの message を画面表示にそのまま使う。
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "名前の変更に失敗しました");
    }
  },
};
