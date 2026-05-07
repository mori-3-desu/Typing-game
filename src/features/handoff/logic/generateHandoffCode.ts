const HANDOFF_VERSION = 1;

type HandoffData = {
  uuid: string | null;
  refreshToken: string | null;
  name: string | null;
};

/**
 * 引継ぎ用認証データのデコード
 *  @description
 *  JWTはステートレスで便利な反面、有効期限内の失効（Revoke）が困難であり、
 *  引継ぎコードのように長期間保持される可能性があるデータでは奪取時のリスクが高い。
 *
 *  認証の主体をサーバー側で管理可能な refreshToken に集約。
 *  万が一引継ぎコードが流出した際や、なりすましの疑いがある場合に、
 *  サーバー側で該当トークンを無効化（Revoke）できる設計とし、安全性を担保する。
 */
export const buildHandoffCode = (source: HandoffData): string => {
  if (!source.uuid || !source.refreshToken)
    throw new Error("引継ぎ可能なデータがありません");

  const data = {
    ...source,
    v: HANDOFF_VERSION,
  };

  const utf8 = new TextEncoder().encode(JSON.stringify(data));
  return btoa(String.fromCharCode(...utf8));
};
