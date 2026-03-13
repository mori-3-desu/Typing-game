import { supabase } from "../supabase";
import {
  type DifficultyLevel,
  type RankingScore,
  type UpdateHighscoreParams,
  type WordDataMap,
  type WordRow,
} from "../types";
import { LIMIT_DATA } from "../utils/constants";

// 🛡️ 型ガード関数（Type Guard）
// 文字列が本当に "EASY" | "NORMAL" | "HARD" のいずれかかチェックする守衛さん
// これを通れば、TypeScriptは安心して DifficultyLevel 型として扱ってくれます
function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return (
    typeof value === "string" && ["EASY", "NORMAL", "HARD"].includes(value)
  );
}

export const DatabaseService = {
  /**
   * ゲーム開始時に必要なデータ（単語・NGワード）を一括取得
   * 取得したデータが正しい形式かチェックしながら格納します
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

    // 2. NGワードの取得
    const { data: ngData, error: ngError } = await supabase
      .from("ng_words")
      .select("word");
    if (ngError) throw ngError;

    // 3. データの整形とバリデーション
    const formattedData: WordDataMap = { EASY: [], NORMAL: [], HARD: [] };

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

      // 2. 守衛さん（isDifficultyLevel）を呼び出す！
      // 以前のコード: if (["EASY", "NORMAL", "HARD"].includes(cleanLevel)) {
      if (isDifficultyLevel(cleanLevel)) {
        // ★ ここに入った瞬間、TypeScriptは
        // 「cleanLevel はただの string ではなく DifficultyLevel だ」と認識します。

        if (formattedData[cleanLevel]) {
          formattedData[cleanLevel].push({ jp: cleanJp, roma: cleanRoma });
        }
      } else {
        console.warn(`[Data Skip] 未知のデータ: ${row.difficulty}`);
      }
    });

    return {
      formattedData,
      ngList: ngData?.map((item) => item.word) || [],
    };
  },

  /**
   * ハイスコア更新処理
   * Database側の関数(RPC)を呼び出して、一発で更新・挿入を行う
   */
  async updateHighscore(params: UpdateHighscoreParams) {
    const { error } = await supabase.rpc("update_highscore", params);
    if (error) throw error;
    return true;
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
    limit: number,
    signal?: AbortSignal,
  ): Promise<RankingScore[]> {
    const query = supabase
      .from("scores")
      .select("*")
      .eq("difficulty", difficulty)
      .eq("is_creator", isCreator)
      .order("score", { ascending: false })
      .limit(limit);

    if (signal) {
      query.abortSignal(signal);
    }

    const { data, error } = await query;

    if (error) {
      if (signal?.aborted) {
        throw new Error("Aborted");
      }
      throw error;
    }

    if (signal?.aborted) return [];

    // 🛡️ 防衛的プログラミング：返ってきたデータが要求した難易度と一致するか念のため確認
    const hasInvalidData = data?.some((row) => row.difficulty !== difficulty);
    if (hasInvalidData) {
      throw new Error(
        `[Integrity Error] 要求した難易度(${difficulty})と異なるデータが含まれています。`,
      );
    }

    return data || [];
  },

  /**
   * 全国ランキングを取得
   * 共通ロジック(getScores)を呼び出すだけ
   */
  async getRanking(
    difficulty: DifficultyLevel,
    signal?: AbortSignal,
  ): Promise<RankingScore[]> {
    return this.getScores(difficulty, false, LIMIT_DATA.RANKING_LIMIT, signal);
  },

  /**
   * 開発者スコアを取得
   * 共通ロジック(getScores)を呼び出すだけ
   */
  async getDevScore(
    difficulty: DifficultyLevel,
    signal?: AbortSignal,
  ): Promise<RankingScore[]> {
    return this.getScores(difficulty, true, 1, signal);
  },

  /**
   * ユーザー名の更新
   * 名前だけを変更したい場合に使用
   */
  async updateUserName(userId: string, newName: string) {
    const { error } = await supabase
      .from("scores")
      .update({ name: newName })
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  },
};
