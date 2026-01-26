import { supabase } from "../supabase";
import { LIMIT_DATA } from "../utils/setting";
import { 
  type DifficultyLevel, 
  type WordRow, 
  type WordDataMap, 
  type UpdateHighscoreParams,
  type RankingScore 
} from "../types";

// 🛡️ 型ガード関数（Type Guard）
// 文字列が本当に "EASY" | "NORMAL" | "HARD" のいずれかかチェックする守衛さん
// これを通れば、TypeScriptは安心して DifficultyLevel 型として扱ってくれます
function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return typeof value === "string" && ["EASY", "NORMAL", "HARD"].includes(value);
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

    // 2. NGワードの取得
    const { data: ngData, error: ngError } = await supabase
      .from("ng_words")
      .select("word");
    if (ngError) throw ngError;

    // 3. データの整形とバリデーション
    const formattedData: WordDataMap = { EASY: [], NORMAL: [], HARD: [] };

    wordsData?.forEach((row: WordRow) => {
      // ⚠️ ここで型ガードを使用！ DBに変な文字列が入っていてもアプリを落とさない
      if (!isDifficultyLevel(row.difficulty)) {
        console.warn(`[Data Skip] 不正な難易度データが見つかりました: ${row.difficulty}`);
        return; // 無効なデータはスキップ
      }

      // ここに来た時点で、row.difficulty は DifficultyLevel 型であることが保証されている
      const level = row.difficulty;
      
      if (formattedData[level]) {
        formattedData[level].push({ jp: row.jp, roma: row.roma });
      }
    });

    return { 
      formattedData, 
      ngList: ngData?.map((item) => item.word) || [] 
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
  async getScores(difficulty: DifficultyLevel, isCreator: boolean, limit: number): Promise<RankingScore[]> {
    const { data, error } = await supabase
      .from("scores")
      .select("*")
      .eq("difficulty", difficulty)
      .eq("is_creator", isCreator)
      .order("score", { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // 🛡️ 防衛的プログラミング：返ってきたデータが要求した難易度と一致するか念のため確認
    const hasInvalidData = data?.some(row => row.difficulty !== difficulty);
    if (hasInvalidData) {
      throw new Error(`[Integrity Error] 要求した難易度(${difficulty})と異なるデータが含まれています。`);
    }

    return data || [];
  },

  /**
   * 全国ランキングを取得
   * 共通ロジック(getScores)を呼び出すだけ
   */
  async getRanking(difficulty: DifficultyLevel): Promise<RankingScore[]> {
    return this.getScores(difficulty, false, LIMIT_DATA.RANKING_LIMIT);
  },

  /**
   * 開発者スコアを取得
   * 共通ロジック(getScores)を呼び出すだけ
   */
  async getDevScore(difficulty: DifficultyLevel): Promise<RankingScore[]> {
    return this.getScores(difficulty, true, 1);
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
  }
};