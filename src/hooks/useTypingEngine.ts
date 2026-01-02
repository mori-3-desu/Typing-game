// src/hooks/useTypingEngine.ts

// 1. ローマ字定義
const ROMA_VARIATIONS: Record<string, string[]> = {
    // ■あ行
    "a": ["a"], "i": ["i", "yi"], "u": ["u", "wu", "whu"], "e": ["e"], "o": ["o"],
    
    // ■か行
    "ka": ["ka", "ca"], 
    "ki": ["ki"], 
    "ku": ["ku", "cu", "qu"], 
    "ke": ["ke"], 
    "ko": ["ko", "co"],
    
    // ■さ行
    "sa": ["sa"], 
    "si": ["si", "shi", "ci"], "shi": ["si", "shi", "ci"], 
    "su": ["su"], 
    "se": ["se", "ce"], 
    "so": ["so"],
    
    // ■た行
    "ta": ["ta"], 
    "ti": ["ti", "chi"], "chi": ["ti", "chi"], 
    "tu": ["tu", "tsu"], "tsu": ["tu", "tsu"], 
    "te": ["te"], 
    "to": ["to"],
    
    // ■な行
    "na": ["na"], "ni": ["ni"], "nu": ["nu"], "ne": ["ne"], "no": ["no"],
    
    // ■は行
    "ha": ["ha"], 
    "hi": ["hi"], 
    "hu": ["hu", "fu"], "fu": ["hu", "fu"], 
    "he": ["he"], 
    "ho": ["ho"],
    
    // ■ま行
    "ma": ["ma"], "mi": ["mi"], "mu": ["mu"], "me": ["me"], "mo": ["mo"],
    
    // ■や行
    "ya": ["ya"], "yu": ["yu"], "yo": ["yo"],
    
    // ■ら行
    "ra": ["ra"], "ri": ["ri"], "ru": ["ru"], "re": ["re"], "ro": ["ro"],
    
    // ■わ行
    "wa": ["wa"], "wo": ["wo"], 
    
    // ■が行
    "ga": ["ga"], "gi": ["gi"], "gu": ["gu"], "ge": ["ge"], "go": ["go"],
    
    // ■ざ行
    "za": ["za"], 
    "ji": ["ji", "zi"], "zi": ["ji", "zi"],
    "zu": ["zu"], "ze": ["ze"], "zo": ["zo"],
    
    // ■だ行
    "da": ["da"], "di": ["di"], "du": ["du"], "de": ["de"], "do": ["do"],
    
    // ■ば行
    "ba": ["ba"], "bi": ["bi"], "bu": ["bu"], "be": ["be"], "bo": ["bo"],
    
    // ■ぱ行
    "pa": ["pa"], "pi": ["pi"], "pu": ["pu"], "pe": ["pe"], "po": ["po"],

    // ■小書き（捨て仮名：ぁ、ぃ、ぅ、ぇ、ぉ）
    "la": ["la", "xa"], "xa": ["la", "xa"],
    "li": ["li", "xi"], "xi": ["li", "xi"], "lyi": ["lyi", "xyi"], "xyi": ["lyi", "xyi"],
    "lu": ["lu", "xu"], "xu": ["lu", "xu"],
    "le": ["le", "xe"], "xe": ["le", "xe"], "lye": ["lye", "xye"], "xye": ["lye", "xye"],
    "lo": ["lo", "xo"], "xo": ["lo", "xo"],
    
    // ■っ（小さいつ）単体入力用
    "ltu": ["ltu", "xtu"], "xtu": ["ltu", "xtu"], "ltsu": ["ltsu", "xtsu"],

    // ■や行 捨て仮名（ゃ、ゅ、ょ）
    "lya": ["lya", "xya"], "xya": ["lya", "xya"],
    "lyu": ["lyu", "xyu"], "xyu": ["lyu", "xyu"],
    "lyo": ["lyo", "xyo"], "xyo": ["lyo", "xyo"],

    // ■わ行 捨て仮名（ゎ）
    "lwa": ["lwa", "xwa"], "xwa": ["lwa", "xwa"],

    // ----------------------------------------------------
    // ■拗音（きゃ、きゅ、きょ 等）
    // ----------------------------------------------------
    "kya": ["kya"], "kyu": ["kyu"], "kyo": ["kyo"],
    
    "sya": ["sya", "sha"], "sha": ["sya", "sha"],
    "syu": ["syu", "shu"], "shu": ["syu", "shu"],
    "syo": ["syo", "sho"], "sho": ["syo", "sho"],
    
    "tya": ["tya", "cha", "cya"], "cha": ["tya", "cha", "cya"], "cya": ["tya", "cha", "cya"],
    "tyu": ["tyu", "chu", "cyu"], "chu": ["tyu", "chu", "cyu"], "cyu": ["tyu", "chu", "cyu"],
    "tyo": ["tyo", "cho", "cyo"], "cho": ["tyo", "cho", "cyo"], "cyo": ["tyo", "cho", "cyo"],
    
    "nya": ["nya"], "nyu": ["nyu"], "nyo": ["nyo"],
    
    "hya": ["hya"], "hyu": ["hyu"], "hyo": ["hyo"],
    
    "mya": ["mya"], "myu": ["myu"], "myo": ["myo"],
    
    "rya": ["rya"], "ryu": ["ryu"], "ryo": ["ryo"],
    
    "gya": ["gya"], "gyu": ["gyu"], "gyo": ["gyo"],
    
    "jya": ["ja", "zya", "jya"], "zya": ["ja", "zya", "jya"], "ja": ["ja", "zya", "jya"],
    "jyu": ["ju", "zyu", "jyu"], "zyu": ["ju", "zyu", "jyu"], "ju": ["ju", "zyu", "jyu"],
    "jyo": ["jo", "zyo", "jyo"], "zyo": ["jo", "zyo", "jyo"], "jo": ["jo", "zyo", "jyo"],
    
    "bya": ["bya"], "byu": ["byu"], "byo": ["byo"],
    "pya": ["pya"], "pyu": ["pyu"], "pyo": ["pyo"],

    // ----------------------------------------------------
    // ■外来語・拡張表現（ふぁ、ゔぁ、てぃ、うぃ 等）
    // ----------------------------------------------------
    // F系 (ふぁ、ふぃ、ふぇ、ふぉ)
    "fa": ["fa"], "fi": ["fi"], "fe": ["fe"], "fo": ["fo"], "fyu": ["fyu"],

    // V系 (ゔぁ、ゔぃ、ゔ、ゔぇ、ゔぉ)
    "va": ["va"], "vi": ["vi"], "vu": ["vu"], "ve": ["ve"], "vo": ["vo"], "vyu": ["vyu"],

    // W系 (うぃ、うぇ)
    "wi": ["wi"], "we": ["we"], 
    "wha": ["wha"], "whi": ["whi"], "whe": ["whe"], "who": ["who"], // うぁ、うぃ、うぇ、うぉ の別入力

    // T系拡張 (てぃ、とぅ 等)
    "thi": ["thi"], // てぃ
    "thu": ["thu"], // てゅ
    "twa": ["twa"], // とぁ
    "dha": ["dha"], // でゃ
    "dhi": ["dhi"], // でぃ
    "dhu": ["dhu"], // でゅ
    "dhe": ["dhe"], // でぇ
    "dho": ["dho"], // でょ

    // つぁ、つぃ、つぇ、つぉ
    "tsa": ["tsa"], "tsi": ["tsi"], "tse": ["tse"], "tso": ["tso"],

    // くぁ、ぐぁ 等
    "kwa": ["kwa", "qa"], "kwi": ["kwi", "qi"], "kwe": ["kwe", "qe"], "kwo": ["kwo", "qo"], // くぁ、くぃ...
    "gwa": ["gwa"], "gwi": ["gwi"], "gwe": ["gwe"], "gwo": ["gwo"],

    // しぇ、じぇ、ちぇ
    "she": ["she", "sye"], "sye": ["she", "sye"],
    "je": ["je", "jye", "zye"], "zye": ["je", "jye", "zye"], "jye": ["je", "jye", "zye"],
    "che": ["che", "tye", "cye"], "tye": ["che", "tye", "cye"], "cye": ["che", "tye", "cye"],

    // ----------------------------------------------------
    // ■記号・その他
    // ----------------------------------------------------
    "n": ["n", "xn", "nn"], "nn": ["nn", "xn"], 
    "、": ["、", ","], "。": ["。", "."],
    "-": ["-"],

    // 単体キー（予備）
    "k": ["k", "c"], "s": ["s"], "t": ["t"], "h": ["h"], "f": ["f"], "m": ["m"], 
    "y": ["y"], "r": ["r"], "w": ["w"], "g": ["g"], "z": ["z"], "d": ["d"], 
    "b": ["b"], "p": ["p"], "c": ["k", "c"], "q": ["q"], "x": ["x"]
};

// 2. Segment クラス
export class Segment {
    canonical: string;
    patterns: string[];
    inputBuffer: string;
    typedLog: { char: string; color: string }[];
    isExpanded: boolean;

    constructor(canonical: string) {
        this.canonical = canonical;
        this.patterns = ROMA_VARIATIONS[canonical] || [canonical]; 
        this.inputBuffer = "";
        this.typedLog = []; 
        this.isExpanded = false; 
    }

    get display() {
        if (this.inputBuffer === "") return this.patterns[0];
        const match = this.patterns.find(p => p.startsWith(this.inputBuffer));
        return match ? match : this.patterns[0];
    }

    getCurrentChar() { 
        const disp = this.display;
        return disp[this.inputBuffer.length] || ""; 
    }
    
    getRemaining() { 
        const disp = this.display;
        return disp.slice(this.inputBuffer.length + 1); 
    }

    handleKey(k: string): string {
        let inputChar = k;
        const nextExpected = this.getCurrentChar();
        if (nextExpected === '、' && k === ',') inputChar = '、';
        else if (nextExpected === '。' && k === '.') inputChar = '。';

        const nextBuffer = this.inputBuffer + inputChar;
        const possibleRoutes = this.patterns.filter(p => p.startsWith(nextBuffer));

        // --- A. 正解ルート ---
        if (possibleRoutes.length > 0) {
            this.inputBuffer = nextBuffer;
            this.typedLog.push({ char: inputChar, color: "#4aff50" }); // 緑

            const exactMatch = possibleRoutes.find(p => p === this.inputBuffer);
            if (exactMatch) return "NEXT"; 
            return "OK";
        }

        // --- B. ミスルート ---
        if (this.patterns.includes(this.inputBuffer)) {
            return "MISS";
        }

        const currentPattern = this.patterns.find(p => p.startsWith(this.inputBuffer)) || this.patterns[0];
        const expectedChar = currentPattern[this.inputBuffer.length];

        if (!expectedChar) return "MISS"; 

        // 赤色進行
        this.inputBuffer += expectedChar;
        this.typedLog.push({ char: expectedChar, color: "#ff4444" });

        if (this.patterns.includes(this.inputBuffer)) {
            return "MISS_NEXT"; 
        }
        
        return "MISS_ADVANCE"; 
    }

    // ★重要：ここを追加！これが無いとエラーになります
    backspace(): boolean {
        if (this.inputBuffer.length > 0) {
            this.inputBuffer = this.inputBuffer.slice(0, -1);
            this.typedLog.pop();
            return true;
        }
        return false;
    }

    isDone() {
        return this.patterns.includes(this.inputBuffer);
    }
}

// 3. TypingEngine クラス
export class TypingEngine {
    segments: Segment[];
    segIndex: number;

    constructor(romaText: string) {
        this.segments = this.segmentize(romaText);
        this.segIndex = 0;
    }

    segmentize(roma: string): Segment[] {
        const out: Segment[] = [];
        let i = 0;
        const keys = Object.keys(ROMA_VARIATIONS).sort((a, b) => b.length - a.length);

        while (i < roma.length) {
            let hit = false;
            for (const key of keys) {
                if (roma.startsWith(key, i)) {
                    out.push(new Segment(key));
                    i += key.length;
                    hit = true;
                    break;
                }
            }
            if (!hit) {
                out.push(new Segment(roma[i]));
                i++;
            }
        }
        return out;
    }

    input(key: string): { status: string } {
        const seg = this.segments[this.segIndex];
        
        // n拡張チェック
        if (key === 'n' && this.segIndex > 0) {
            const prevSeg = this.segments[this.segIndex - 1];
            let isCorrectForCurrent = false;
            if (seg) {
                isCorrectForCurrent = seg.patterns.some(p => p.startsWith(seg.inputBuffer + key));
            }
            if (!isCorrectForCurrent && prevSeg.canonical === 'n' && prevSeg.inputBuffer === 'n') {
                prevSeg.inputBuffer = "nn";
                prevSeg.typedLog.push({ char: 'n', color: "#4aff50" });
                prevSeg.isExpanded = true; 
                return { status: "EXPANDED" };
            }
        }

        if (!seg) return { status: "END" };

        const result = seg.handleKey(key);
        
        if (result === "NEXT" || result === "MISS_NEXT") {
            this.segIndex++;
            return { status: result };
        }
        
        if (result === "MISS_ADVANCE") return { status: "MISS_ADVANCE" };
        if (result === "OK") return { status: "OK" };
        
        return { status: "MISS" };
    }

    // ★重要：ここも追加！
    backspace(): { status: string } {
        if (this.segIndex >= this.segments.length) {
            this.segIndex = this.segments.length - 1;
        }

        let seg = this.segments[this.segIndex];
        
        if (seg.inputBuffer.length === 0 && this.segIndex > 0) {
            this.segIndex--;
            seg = this.segments[this.segIndex];
        }

        if (seg.isExpanded && seg.inputBuffer === "nn") {
            seg.inputBuffer = "";
            seg.typedLog = [];
            seg.isExpanded = false;
            return { status: "BACK_EXPANDED" };
        }

        seg.backspace();
        
        // 戻した結果、まだ完了状態なら（あまりないケースだが）戻す？
        // 基本的には文字を消すだけ
        return { status: "BACK" };
    }

    getDisplayState() {
        let typed = "";
        let current = "";
        let remaining = "";

        this.segments.forEach((seg, i) => {
            if (i < this.segIndex) {
                typed += seg.inputBuffer; 
            } else if (i === this.segIndex) {
                current = seg.inputBuffer + seg.getRemaining();
            } else {
                remaining += seg.display;
            }
        });

        return { 
            segments: this.segments, 
            currentIndex: this.segIndex,
            isFinished: this.segIndex >= this.segments.length
        };
    }
}