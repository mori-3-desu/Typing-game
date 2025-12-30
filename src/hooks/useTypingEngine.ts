// src/hooks/useTypingEngine.ts

// 1. ローマ字定義
const ROMA_VARIATIONS: Record<string, string[]> = {
    "a": ["a"], "i": ["i", "yi"], "u": ["u", "wu"], "e": ["e", "ye"], "o": ["o"],
    "ka": ["ka", "ca"], "ca": ["ka", "ca"],
    "ki": ["ki"], 
    "ku": ["ku", "cu", "qu"], "cu": ["ku", "cu", "qu"], "qu": ["ku", "cu", "qu"],
    "ke": ["ke"], 
    "ko": ["ko", "co"], "co": ["ko", "co"],
    "sa": ["sa"], 
    "si": ["si", "shi", "ci"], "shi": ["si", "shi", "ci"], "ci": ["si", "shi", "ci"],
    "su": ["su"], 
    "se": ["se", "ce"], "ce": ["se", "ce"],
    "so": ["so"],
    "ta": ["ta"], 
    "ti": ["ti", "chi"], "chi": ["ti", "chi"], 
    "tu": ["tu", "tsu"], "tsu": ["tu", "tsu"], 
    "te": ["te"], 
    "to": ["to"],
    "na": ["na"], "ni": ["ni"], "nu": ["nu"], "ne": ["ne"], "no": ["no"],
    "ha": ["ha"], 
    "hi": ["hi"], 
    "hu": ["fu", "hu"], "fu": ["fu", "hu"], 
    "he": ["he"], 
    "ho": ["ho"],
    "ma": ["ma"], "mi": ["mi"], "mu": ["mu"], "me": ["me"], "mo": ["mo"],
    "ya": ["ya"], "yu": ["yu"], "yo": ["yo"],
    "ra": ["ra"], "ri": ["ri"], "ru": ["ru"], "re": ["re"], "ro": ["ro"],
    "wa": ["wa"], "wo": ["wo"], 
    "ga": ["ga"], "gi": ["gi"], "gu": ["gu"], "ge": ["ge"], "go": ["go"],
    "za": ["za"], 
    "ji": ["ji", "zi"], "zi": ["ji", "zi"],
    "zu": ["zu"], "ze": ["ze"], "zo": ["zo"],
    "da": ["da"], "di": ["di"], "du": ["du"], "de": ["de"], "do": ["do"],
    "ba": ["ba"], "bi": ["bi"], "bu": ["bu"], "be": ["be"], "bo": ["bo"],
    "pa": ["pa"], "pi": ["pi"], "pu": ["pu"], "pe": ["pe"], "po": ["po"],
    "fa": ["fa"], "fi": ["fi"], "fe": ["fe"], "fo": ["fo"],
    "ja": ["ja", "jya", "zya"], "jya": ["ja", "jya", "zya"], "zya": ["ja", "jya", "zya"],
    "ju": ["ju", "jyu", "zyu"], "jyu": ["ju", "jyu", "zyu"], "zyu": ["ju", "jyu", "zyu"],
    "jo": ["jo", "jyo", "zyo"], "jyo": ["jo", "jyo", "zyo"], "zyo": ["jo", "jyo", "zyo"],
    "n": ["n", "xn", "nn"], "nn": ["nn", "xn"], 
    "、": ["、", ","], "。": ["。", "."],
    "k": ["k", "c"], "s": ["s"], "t": ["t"], "h": ["h"], "f": ["f"], "m": ["m"], 
    "y": ["y"], "r": ["r"], "w": ["w"], "g": ["g"], "z": ["z"], "d": ["d"], 
    "b": ["b"], "p": ["p"], "c": ["k", "c"], "q": ["q"], "x": ["x"], "-": ["-"]
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