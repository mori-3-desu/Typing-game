// ジェネリクスを使用し、柔軟にデータの型を変換できるように
// ローカルストレージのデータを操作する。
export const storage = {
  get<T>(key: string, parse: (raw: string) => T): T | null {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return parse(raw);
    } catch {
      console.warn(`[Storage] Invalid data at "${key}", removing.`);
      localStorage.removeItem(key);
      return null;
    }
  },

  set(key: string, value: string): void {
    localStorage.setItem(key, value);
  },

  setJSON<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: string): void {
    localStorage.removeItem(key);
  },
} as const;

// スコアだけを取得したい時と詳細リザルトでオブジェクトを取得したい時で
// 処理を切り分けている。
// スコアは小数点を扱わないのでNumber.isIntegerで整数以外は弾く
export const parseNonNegativeInt = (raw: string): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error("invalid");
  return n;
};

// 勉強のために残してある
// 同じバリデーションを何度も使うときに使える
// export const parseJSON =
//   <T>(validate: (v: unknown) => v is T) =>
//   (raw: string): T => {
//     const data: unknown = JSON.parse(raw);
//     if (!validate(data)) throw new Error("invalid shape");
//     return data;
//   };
