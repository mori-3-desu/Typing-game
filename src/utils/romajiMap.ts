// 1. ローマ字定義
export const ROMA_VARIATIONS: Record<string, string[]> = {
  // あ行
  a: ["a"],
  i: ["i", "yi"],
  u: ["u", "wu", "whu"],
  e: ["e"],
  o: ["o"],

  // か行
  ka: ["ka", "ca"],
  ki: ["ki"],
  ku: ["ku", "cu", "qu"],
  ke: ["ke"],
  ko: ["ko", "co"],

  // さ行
  sa: ["sa"],
  si: ["si", "shi", "ci"],
  shi: ["si", "shi", "ci"],
  su: ["su"],
  se: ["se", "ce"],
  so: ["so"],

  // た行
  ta: ["ta"],
  ti: ["ti", "chi"],
  chi: ["ti", "chi"],
  tu: ["tu", "tsu"],
  tsu: ["tu", "tsu"],
  te: ["te"],
  to: ["to"],

  // な行
  na: ["na"],
  ni: ["ni"],
  nu: ["nu"],
  ne: ["ne"],
  no: ["no"],

  // は行
  ha: ["ha"],
  hi: ["hi"],
  hu: ["hu", "fu"],
  fu: ["hu", "fu"],
  he: ["he"],
  ho: ["ho"],

  // ま行
  ma: ["ma"],
  mi: ["mi"],
  mu: ["mu"],
  me: ["me"],
  mo: ["mo"],

  // や行
  ya: ["ya"],
  yu: ["yu"],
  yo: ["yo"],

  // ら行
  ra: ["ra"],
  ri: ["ri"],
  ru: ["ru"],
  re: ["re"],
  ro: ["ro"],

  // わ行
  wa: ["wa"],
  wo: ["wo"],

  // が行
  ga: ["ga"],
  gi: ["gi"],
  gu: ["gu"],
  ge: ["ge"],
  go: ["go"],

  // ざ行
  za: ["za"],
  ji: ["ji", "zi"],
  zi: ["ji", "zi"],
  zu: ["zu"],
  ze: ["ze"],
  zo: ["zo"],

  // だ行
  da: ["da"],
  di: ["di"],
  du: ["du"],
  de: ["de"],
  do: ["do"],

  // ば行
  ba: ["ba"],
  bi: ["bi"],
  bu: ["bu"],
  be: ["be"],
  bo: ["bo"],

  // ぱ行
  pa: ["pa"],
  pi: ["pi"],
  pu: ["pu"],
  pe: ["pe"],
  po: ["po"],

  // 小書き（捨て仮名：ぁ、ぃ、ぅ、ぇ、ぉ）
  la: ["la", "xa"],
  xa: ["la", "xa"],
  li: ["li", "xi"],
  xi: ["li", "xi"],
  lyi: ["lyi", "xyi"],
  xyi: ["lyi", "xyi"],
  lu: ["lu", "xu"],
  xu: ["lu", "xu"],
  le: ["le", "xe"],
  xe: ["le", "xe"],
  lye: ["lye", "xye"],
  xye: ["lye", "xye"],
  lo: ["lo", "xo"],
  xo: ["lo", "xo"],

  // っ（小さいつ）単体入力用
  ltu: ["ltu", "xtu"],
  xtu: ["ltu", "xtu"],
  ltsu: ["ltsu", "xtsu"],

  // や行 捨て仮名（ゃ、ゅ、ょ）
  lya: ["lya", "xya"],
  xya: ["lya", "xya"],
  lyu: ["lyu", "xyu"],
  xyu: ["lyu", "xyu"],
  lyo: ["lyo", "xyo"],
  xyo: ["lyo", "xyo"],

  // わ行 捨て仮名（ゎ）
  lwa: ["lwa", "xwa"],
  xwa: ["lwa", "xwa"],

  // 拗音（きゃ、きゅ、きょ 等）
  kya: ["kya"],
  kyu: ["kyu"],
  kyo: ["kyo"],

  sya: ["sya", "sha"],
  sha: ["sya", "sha"],
  syu: ["syu", "shu"],
  shu: ["syu", "shu"],
  syo: ["syo", "sho"],
  sho: ["syo", "sho"],

  tya: ["tya", "cha", "cya"],
  cha: ["tya", "cha", "cya"],
  cya: ["tya", "cha", "cya"],
  tyu: ["tyu", "chu", "cyu"],
  chu: ["tyu", "chu", "cyu"],
  cyu: ["tyu", "chu", "cyu"],
  tyo: ["tyo", "cho", "cyo"],
  cho: ["tyo", "cho", "cyo"],
  cyo: ["tyo", "cho", "cyo"],

  nya: ["nya"],
  nyu: ["nyu"],
  nyo: ["nyo"],

  hya: ["hya"],
  hyu: ["hyu"],
  hyo: ["hyo"],

  mya: ["mya"],
  myu: ["myu"],
  myo: ["myo"],

  rya: ["rya"],
  ryu: ["ryu"],
  ryo: ["ryo"],

  gya: ["gya"],
  gyu: ["gyu"],
  gyo: ["gyo"],

  jya: ["ja", "zya", "jya"],
  zya: ["ja", "zya", "jya"],
  ja: ["ja", "zya", "jya"],
  jyu: ["ju", "zyu", "jyu"],
  zyu: ["ju", "zyu", "jyu"],
  ju: ["ju", "zyu", "jyu"],
  jyo: ["jo", "zyo", "jyo"],
  zyo: ["jo", "zyo", "jyo"],
  jo: ["jo", "zyo", "jyo"],

  bya: ["bya"],
  byu: ["byu"],
  byo: ["byo"],
  pya: ["pya"],
  pyu: ["pyu"],
  pyo: ["pyo"],

  // 外来語・拡張表現（ふぁ、ゔぁ、てぃ、うぃ 等）

  // F系 (ふぁ、ふぃ、ふぇ、ふぉ)
  fa: ["fa"],
  fi: ["fi"],
  fe: ["fe"],
  fo: ["fo"],
  fyu: ["fyu"],

  // V系 (ゔぁ、ゔぃ、ゔ、ゔぇ、ゔぉ)
  va: ["va"],
  vi: ["vi"],
  vu: ["vu"],
  ve: ["ve"],
  vo: ["vo"],
  vyu: ["vyu"],

  // W系 (うぃ、うぇ)
  wi: ["wi"],
  we: ["we"],
  wha: ["wha"],
  whi: ["whi"],
  whe: ["whe"],
  who: ["who"], // うぁ、うぃ、うぇ、うぉ の別入力

  // T系拡張 (てぃ、とぅ 等)
  thi: ["thi"], // てぃ
  thu: ["thu"], // てゅ
  twa: ["twa"], // とぁ
  dha: ["dha"], // でゃ
  dhi: ["dhi"], // でぃ
  dhu: ["dhu"], // でゅ
  dhe: ["dhe"], // でぇ
  dho: ["dho"], // でょ

  // つぁ、つぃ、つぇ、つぉ
  tsa: ["tsa"],
  tsi: ["tsi"],
  tse: ["tse"],
  tso: ["tso"],

  // くぁ、ぐぁ 等
  kwa: ["kwa", "qa"],
  kwi: ["kwi", "qi"],
  kwe: ["kwe", "qe"],
  kwo: ["kwo", "qo"], // くぁ、くぃ...
  gwa: ["gwa"],
  gwi: ["gwi"],
  gwe: ["gwe"],
  gwo: ["gwo"],

  // しぇ、じぇ、ちぇ
  she: ["she", "sye"],
  sye: ["she", "sye"],
  je: ["je", "jye", "zye"],
  zye: ["je", "jye", "zye"],
  jye: ["je", "jye", "zye"],
  che: ["che", "tye", "cye"],
  tye: ["che", "tye", "cye"],
  cye: ["che", "tye", "cye"],

  // 記号・その他
  n: ["n", "xn", "nn"],
  nn: ["nn", "xn"],
  "、": ["、", ","],
  "。": ["。", "."],
  "-": ["-"],

  // 単体キー（予備）
  k: ["k", "c"],
  s: ["s"],
  t: ["t"],
  h: ["h"],
  f: ["f"],
  m: ["m"],
  y: ["y"],
  r: ["r"],
  w: ["w"],
  g: ["g"],
  z: ["z"],
  d: ["d"],
  b: ["b"],
  p: ["p"],
  c: ["k", "c"],
  q: ["q"],
  x: ["x"],
};
