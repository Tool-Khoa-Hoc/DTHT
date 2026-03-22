const SECTION_RE = /^\s*(?:PHẦN|Phần|PART)\s*([IVXLC\d]+)?\s*[\.\):\-]?\s*(.*)$/i;
const QUESTION_RE = /^\s*(?:Câu|Cau|Câu hỏi|Cau hoi|Question|Q)\s*(?:số|so|number|no\.?)?\s*(\d{1,4})\s*[\.\):\-]?\s*(.*)$/i;
const NUMERIC_QUESTION_RE = /^\s*(\d{1,4})\s*[\.\)]\s+(.+)$/;
const CHOICE_RE = /^\s*([A-Ha-h])\s*[\.\):\-]\s*(.*)$/;
const CHOICE_PREFIX_RE = /^\s*[A-Ha-h]\s*[\.\):\-]\s*/;
const STATEMENT_RE = /^\s*([a-d])\s*[\.\):\-]\s*(.*)$/;
const STATEMENT_PREFIX_RE = /^\s*[a-d]\s*[\.\):\-]\s*/;
const ANSWER_TAG = "(?:Đáp\\s*án|Dap\\s*an|ĐA|DA|Answer)";
const ANSWER_ONLY_RE = new RegExp(`^\\s*${ANSWER_TAG}\\s*[:\\-]\\s*(.+?)\\s*$`, "i");
const ANSWER_INLINE_RE = new RegExp(`\\s*(?:\\(|\\[)?\\s*${ANSWER_TAG}\\s*[:\\-]\\s*([A-Ha-h]|[ĐSđsTFtf]{1,8}|-?\\d+(?:[.,]\\d+)?)\\s*(?:\\)|\\])?\\s*$`, "i");
const ANSWER_KEY_HEADER_RE = /^\s*(?:Bảng\s*đáp\s*án|Bang\s*dap\s*an|Đáp\s*án|Dap\s*an|Answer\s*key)\s*:?\s*(.*)$/i;
const ANSWER_PAIR_RE = /(?:Câu\s*)?(\d{1,4})\s*[-\.:)]\s*([A-Ha-h]|[ĐSđsTFtf]{1,8}|-?\d+(?:[.,]\d+)?)/gi;
const COMPACT_ANSWER_PAIR_RE = /\b(\d{1,4})\s*([A-Ha-h])\b/g;
const INLINE_CHOICE_MARK_RE = /([A-Ha-h])\s*[\.\):]\s*/g;
const INLINE_STATEMENT_MARK_RE = /([a-d])\s*[\.\):]\s*/g;
const QUESTION_PREFIX_RE = /^\s*(?:Câu|Cau|Câu hỏi|Cau hoi|Question|Q)\s*(?:số|so|number|no\.?)?\s*\d{1,4}\s*[\.\):\-]?\s*/i;
const NUMERIC_PREFIX_RE = /^\s*\d{1,4}\s*[\.\)]\s+/;
const EMBEDDED_QUESTION_SPLIT_RE = /(?<!^)\s+(?=(?:Câu|Cau|Question|Q)\s*(?:số|so|number|no\.?)?\s*\d{1,4}\s*[\.\):\-])/i;
const SPACE_RE = /\s+/g;
const TABLE_RULE_RE = /^:?-{2,}:?$/;
const RAW_TABLE_ROW_RE = /^\[\*\s*(.*?)\s*\*\]$/;
const MARKDOWN_TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/;

const SHORT_ANSWER_HINTS = ["trả lời ngắn", "tu luan", "tự luận", "short answer", "điền", "dien vao"];
const TRUE_FALSE_HINTS = [
    "đúng sai",
    "dung sai",
    "đúng hay sai",
    "đúng hoặc sai",
    "dung hoac sai",
    "sai hay đúng",
    "true false",
    "true/false",
];
const SINGLE_CHOICE_HINTS = ["trắc nghiệm", "trac nghiem", "chọn đáp án", "chon dap an", "multiple choice"];

function splitEmbeddedQuestionLines(line) {
  try {
    const rawChunks = line.split(EMBEDDED_QUESTION_SPLIT_RE);
    const chunks = rawChunks.map(c => c?.trim()).filter(c => c);
    
    const result = [];
    const mergeTailWords = /(?:từ|đến|và|cho|gồm|các|tới|tu|den|va|gom|cac|những)$/i;

    for (const chunk of chunks) {
        if (result.length > 0) {
            const prev = result[result.length - 1].trim();
            const words = prev.split(/\s+/);
            const lastWord = words[words.length - 1].replace(/[,.:;]+$/, "");
            if (mergeTailWords.test(lastWord)) {
                result[result.length - 1] += ' ' + chunk;
                continue;
            }
        }
        result.push(chunk);
    }
    return result;
  } catch (e) {
      return [line.trim()];
  }
}

function unwrapFormatTags(input) {
    let value = String(input || "");
    for (let i = 0; i < 8; i += 1) {
        const next = value
            .replace(/\[!(?:b|i|sub|sup):\$([^$]+)\$\]/gi, "$1")
            .replace(/\[!(?:b|i|sub|sup):([^\]]+)\]/gi, "$1");
        if (next === value) break;
        value = next;
    }
    return value;
}

function cleanupRawLine(input) {
    let s = String(input || "");
    if (!s) return "";

    s = s.replace(/\u00a0/g, " ");
    s = s.replace(/<br\s*\/?>/gi, "\n");
    s = s.replace(/<\/?w:[^>]*>/gi, " ");
    s = s.replace(/<[^>]+>/g, " ");
    s = s.replace(/\\\|/g, "|");
    s = unwrapFormatTags(s);

    return s.replace(/\r/g, "").trim();
}

function normalizeTableRow(line) {
    const raw = String(line || "").trim();
    const rawMatch = RAW_TABLE_ROW_RE.exec(raw);
    if (rawMatch) {
        return `[* ${rawMatch[1].split("|").map((cell) => cell.trim()).join(" | ")} *]`;
    }

    const markdownMatch = MARKDOWN_TABLE_ROW_RE.exec(raw);
    if (markdownMatch) {
        const cells = markdownMatch[1].split("|").map((cell) => cell.trim());
        if (cells.length > 0 && cells.every((cell) => TABLE_RULE_RE.test(cell))) {
            return null;
        }
        return `[* ${cells.join(" | ")} *]`;
    }

    return null;
}

function splitTableRowCells(line) {
    const normalized = normalizeTableRow(line);
    if (!normalized) return null;
    const match = RAW_TABLE_ROW_RE.exec(normalized);
    return match ? match[1].split("|").map((cell) => cell.trim()) : null;
}

function stripMarkupForParsing(input) {
    let s = cleanupRawLine(input);
    s = s.replace(/\[(?:!m|math):\$[\s\S]*?\$\]/gi, " ");
    s = s.replace(/\[img:\$[^$]+\$\]/gi, " ");
    s = s.replace(/\[br\]/gi, " ");
    s = s.replace(/^\[\*\s*/, "");
    s = s.replace(/\s*\*\]$/, "");
    s = s.replace(/\|/g, " ");
    return s.replace(SPACE_RE, " ").trim();
}

function splitRawLineToChunks(rawLine) {
    const cleaned = cleanupRawLine(rawLine);
    if (!cleaned) return [];

    const normalizedTable = normalizeTableRow(cleaned);
    if (normalizedTable) {
        const cells = splitTableRowCells(normalizedTable) || [];
        const plain = cells.map((cell) => stripMarkupForParsing(cell)).filter(Boolean).join(" | ");
        return plain ? [{
            normalized: normalizedTable,
            plain,
            kind: "table",
        }] : [];
    }

    const chunks = cleaned
        .replace(/\s*\|\s*/g, "\n")
        .split(/\n+/)
        .map((chunk) => chunk.trim())
        .filter(Boolean);

    const out = [];
    for (const chunk of chunks) {
        if (TABLE_RULE_RE.test(chunk) || /^-{3,}$/.test(chunk)) continue;
        const embedded = splitEmbeddedQuestionLines(chunk);
        for (const piece of embedded) {
            const normalized = piece.replace(SPACE_RE, " ").trim();
            if (!normalized) continue;
            const plain = stripMarkupForParsing(piece);
            const hasMediaToken = /\[(?:img:\$[^$]+\$|(?:!m|math):\$[\s\S]*?\$)\]/i.test(normalized);
            if (!plain && !hasMediaToken) continue;
            if (plain && (TABLE_RULE_RE.test(plain) || /^-{3,}$/.test(plain))) continue;
            out.push({
                normalized,
                plain,
                kind: "text",
            });
        }
    }
    return out;
}

function appendContent(current, chunk, asNewline) {
    chunk = chunk.trim();
    if (!chunk) return current;
    if (!current) return chunk;
    const sep = asNewline ? "\n" : " ";
    return `${current}${sep}${chunk}`;
}

function compactSpaces(text) {
    if (!text) return "";
    const lines = text.split("\n").map(l => l.replace(SPACE_RE, " ").trim());
    return lines.filter(l => l).join("\n");
}

function looksLikeNumericQuestionCandidate(content) {
    const low = content.toLowerCase();
    const answerPairRe = /(?:Câu\s*)?(\d{1,4})\s*[-\.:)]\s*([A-Ha-h]|[ĐSđsTFtf]{1,8}|-?\d+(?:[.,]\d+)?)/i;
    const compactAnswerPairRe = /\b(\d{1,4})\s*([A-Ha-h])\b/i;
    if (answerPairRe.test(content) || compactAnswerPairRe.test(content)) {
        return false;
    }
    if (low.includes("đáp án") || low.includes("answer key")) {
        return false;
    }
    const words = low.split(" ");
    return words.length >= 5 || content.includes("?");
}

function matchQuestionStart(plain) {
    const direct = QUESTION_RE.exec(plain);
    if (direct) {
        return [parseInt(direct[1], 10).toString(), direct[2].trim()];
    }
    const fallback = NUMERIC_QUESTION_RE.exec(plain);
    if (fallback && looksLikeNumericQuestionCandidate(fallback[2])) {
        return [parseInt(fallback[1], 10).toString(), fallback[2].trim()];
    }
    return null;
}

function stripQuestionPrefix(text) {
    const cells = splitTableRowCells(text);
    if (cells && cells.length > 0) {
        let first = cells[0].replace(QUESTION_PREFIX_RE, "");
        if (first === cells[0]) {
            first = cells[0].replace(NUMERIC_PREFIX_RE, "");
        }
        return `[* ${[first, ...cells.slice(1)].join(" | ")} *]`;
    }
    let stripped = text.replace(QUESTION_PREFIX_RE, "");
    if (stripped !== text) return stripped;
    return text.replace(NUMERIC_PREFIX_RE, "");
}

function extractInlineChoices(text) {
    // Requires exact consecutive labels logic
    const marks = Array.from(text.matchAll(INLINE_CHOICE_MARK_RE));
    if (marks.length < 2) return [text, []];

    const prefix = text.substring(0, marks[0].index).trim();
    const choices = [];
    
    for (let idx = 0; idx < marks.length; idx++) {
        const mark = marks[idx];
        const start = mark.index + mark[0].length;
        const end = (idx + 1 < marks.length) ? marks[idx + 1].index : text.length;
        const content = text.substring(start, end).replace(/^[ ;]+|[ ;]+$/g, "");
        if (!content) continue;
        choices.push([mark[1].toUpperCase(), content]);
    }

    if (choices.length < 2) return [text, []];

    const labels = choices.map(c => c[0]);
    if (new Set(labels).size !== labels.length) return [text, []];
    
    const startCode = labels[0].charCodeAt(0);
    const expected = Array.from({length: labels.length}, (_, i) => String.fromCharCode(startCode + i));
    
    if (labels.join("") !== expected.join("")) return [text, []];
    return [prefix, choices];
}

function extractInlineStatements(text) {
    const marks = Array.from(text.matchAll(INLINE_STATEMENT_MARK_RE));
    if (marks.length < 2) return [text, []];

    const prefix = text.substring(0, marks[0].index).trim();
    const statements = [];

    for (let idx = 0; idx < marks.length; idx++) {
        const mark = marks[idx];
        const start = mark.index + mark[0].length;
        const end = (idx + 1 < marks.length) ? marks[idx + 1].index : text.length;
        const content = text.substring(start, end).replace(/^[ ;]+|[ ;]+$/g, "");
        if (!content) continue;
        statements.push([mark[1].toLowerCase(), content]);
    }

    if (statements.length < 2) return [text, []];

    const labels = statements.map((entry) => entry[0]);
    if (new Set(labels).size !== labels.length) return [text, []];

    for (let i = 0; i < labels.length; i += 1) {
        if (labels[i] !== String.fromCharCode(97 + i)) return [text, []];
    }

    return [prefix, statements];
}

function extractFallbackChoicesFromStem(question) {
    if (!question || !question.stem || (question.choices || []).length > 0) return;
    const [stemPrefix, inlineChoices] = extractInlineChoices(question.stem);
    if (inlineChoices.length < 2) return;

    question.stem = compactSpaces(stemPrefix);
    question.choices = inlineChoices.map(([label, content]) => ({
        label,
        content: compactSpaces(content),
    }));
}

function normalizeAnswer(raw) {
    let text = raw.replace(SPACE_RE, " ").trim().replace(/^[.,;:\)\]\}]+|[.,;:\)\]\}]+$/g, "");
    if (!text) return text;
    if (/^[A-Ha-h]$/.test(text)) return text.toUpperCase();
    if (/^[ĐDdSsTFtf,\s]{2,20}$/.test(text)) {
        let merged = text.replace(/[,\s]/g, "").toUpperCase();
        merged = merged.replace(/T/g, "D").replace(/F/g, "S");
        return merged.replace(/D/g, "Đ"); // We want True -> Đ, False -> S
    }
    if (/^-?\d+(?:[.,]\d+)?$/.test(text)) {
        return text.replace(",", ".");
    }
    return text;
}

function stripInlineAnswer(text) {
    const match = ANSWER_INLINE_RE.exec(text);
    if (!match) return [text, null];
    const ans = normalizeAnswer(match[1]);
    return [text.substring(0, match.index).trim(), ans];
}

function extractAnswerPairs(text) {
    const source = String(text || "").replace(/\|/g, " ");
    const pairs = [];
    let match;
    const pairRe = new RegExp(ANSWER_PAIR_RE);
    while ((match = pairRe.exec(source)) !== null) {
        pairs.push([parseInt(match[1], 10).toString(), normalizeAnswer(match[2])]);
    }
    if (pairs.length > 0) return pairs;

    const compactRe = new RegExp(COMPACT_ANSWER_PAIR_RE);
    const compact = [];
    while ((match = compactRe.exec(source)) !== null) {
        compact.push([parseInt(match[1], 10).toString(), normalizeAnswer(match[2])]);
    }
    if (compact.length >= 2) return compact;
    return [];
}

function inferSectionQType(text, def) {
    const low = text.toLowerCase();
    if (TRUE_FALSE_HINTS.some(h => low.includes(h))) return "true_false";
    if (SHORT_ANSWER_HINTS.some(h => low.includes(h))) return "short_answer";
    if (SINGLE_CHOICE_HINTS.some(h => low.includes(h))) return "single_choice";
    return def;
}

function hasOrderedStatementLabels(question) {
    const labels = (question?.choices || [])
        .map((choice) => String(choice?.label || "").trim().toLowerCase())
        .filter(Boolean);

    if (labels.length < 2) return false;
    if (new Set(labels).size !== labels.length) return false;
    for (let i = 0; i < labels.length; i += 1) {
        if (labels[i] !== String.fromCharCode(97 + i)) return false;
    }
    return true;
}

function partIdFromHeader(sequence, rawIdx) {
    if (!rawIdx) return `part${sequence}`;
    const parsed = parseInt(rawIdx, 10);
    if (!isNaN(parsed)) return `part${parsed}`;
    
    const romanMap = { "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6 };
    return `part${romanMap[rawIdx.toUpperCase()] || sequence}`;
}

function finalizeQType(question) {
    if (question.part_id === "part3") return "short_answer";
    if (hasOrderedStatementLabels(question)) return "true_false";
    if (question.qtype === "true_false") return "true_false";
    if (question.qtype === "short_answer" && question.choices.length > 0) return "single_choice";
    if (question.qtype === "single_choice" && question.choices.length === 0) return "short_answer";
    return question.qtype;
}

function forceQTypeByPart(partId, currentQType) {
    if (partId === "part3") return "short_answer";
    return currentQType;
}

function createEmptyQuestion(qid, currentPartName, currentPartId, currentQType, sourceNum) {
    return {
        qid: qid,
        stem: "",
        qtype: currentQType,
        section: currentPartName,
        answer: null,
        part_id: currentPartId,
        source_number: sourceNum,
        choices: [],
        solution: ""
    };
}

export function linesToExam(lines, assets) {
    // Replaces tokenize_lines logic minimally since we already formatted markings [!b:...] natively in parser
    const tokenLines = [];
    for (const raw of lines) {
        const chunks = splitRawLineToChunks(raw);
        for (const chunk of chunks) {
            tokenLines.push(chunk);
        }
    }

    const instructionParts = [];
    const questions = [];
    let current = null;
    let lastChoice = null;
    let inChoiceBlock = false;
    let collectingAnswerKey = false;

    let partSeq = 0;
    let currentPartId = "part1";
    let currentPartName = "PHẦN I";
    let currentQType = "single_choice";
    let partQuestionCounter = {};

    let answerKeyGlobal = {};
    let answerKeyPart = {};

    function flushCurrent() {
        if (!current) return;
        extractFallbackChoicesFromStem(current);
        current.stem = compactSpaces(current.stem);
        for (const c of current.choices) {
            c.content = compactSpaces(c.content);
        }
        current.qtype = finalizeQType(current);
        questions.push(current);
        current = null;
        lastChoice = null;
        inChoiceBlock = false;
    }

    function ensurePart() {
        if (partQuestionCounter[currentPartId] !== undefined) return;
        partSeq += 1;
        currentPartId = `part${partSeq}`;
        currentPartName = `PHẦN ${partSeq}`;
        partQuestionCounter[currentPartId] = 0;
    }

    for (const line of tokenLines) {
        if (line.kind === "empty" || !line.normalized) continue;
        const normalized = line.normalized;
        const plain = line.plain || stripMarkupForParsing(normalized);

        if (collectingAnswerKey) {
            const pairs = extractAnswerPairs(plain);
            if (pairs.length > 0) {
                for (const [qnum, ans] of pairs) {
                    answerKeyGlobal[qnum] = ans;
                    answerKeyPart[`${currentPartId}_${qnum}`] = ans;
                }
                continue;
            }
            if (!matchQuestionStart(plain)) {
                instructionParts.push(normalized);
                continue;
            }
            collectingAnswerKey = false;
        }

        const header = SECTION_RE.exec(plain);
        if (header) {
            flushCurrent();
            partSeq += 1;
            currentPartId = partIdFromHeader(partSeq, header[1]);
            currentPartName = normalized;
            currentQType = inferSectionQType(plain, currentQType);
            currentQType = forceQTypeByPart(currentPartId, currentQType);
            if (partQuestionCounter[currentPartId] === undefined) {
                partQuestionCounter[currentPartId] = 0;
            }
            instructionParts.push(normalized);
            continue;
        }

        currentQType = inferSectionQType(plain, currentQType);
        currentQType = forceQTypeByPart(currentPartId, currentQType);
        
        const answerHeader = ANSWER_KEY_HEADER_RE.exec(plain);
        if (answerHeader && questions.length > 0 && current === null) {
            collectingAnswerKey = true;
            const trailing = answerHeader[1].trim();
            if (trailing) {
                for (const [qnum, ans] of extractAnswerPairs(trailing)) {
                    answerKeyGlobal[qnum] = ans;
                    answerKeyPart[`${currentPartId}_${qnum}`] = ans;
                }
            }
            continue;
        }

        const qMatch = matchQuestionStart(plain);
        if (qMatch) {
            flushCurrent();
            ensurePart();
            const [qnum, _] = qMatch;
            partQuestionCounter[currentPartId] = (partQuestionCounter[currentPartId] || 0) + 1;
            const qid = `${currentPartId}.q${partQuestionCounter[currentPartId]}`;
            const sourceNum = qnum ? parseInt(qnum, 10) : null;

            let stem = stripQuestionPrefix(normalized);
            const res = stripInlineAnswer(stem);
            stem = res[0];
            const answer = res[1];
            
            current = createEmptyQuestion(qid, currentPartName, currentPartId, currentQType, sourceNum);
            current.stem = stem.trim();
            current.answer = answer;

            const inlineRes = extractInlineChoices(stem);
            const stemPrefix = inlineRes[0];
            const inlineChoices = inlineRes[1];
            
            if (inlineChoices.length > 0) {
                current.stem = stemPrefix.trim();
                for (const [label, content] of inlineChoices) {
                    current.choices.push({ label, content });
                }
                lastChoice = current.choices.length > 0 ? current.choices[current.choices.length - 1] : null;
                inChoiceBlock = !!lastChoice;
                if (current.qtype === "short_answer") current.qtype = "single_choice";
            }
            continue;
        }

        if (current) {
            if (line.kind === "table") {
                current.stem = appendContent(current.stem, normalized, true);
                inChoiceBlock = false;
                continue;
            }

            const answerOnly = ANSWER_ONLY_RE.exec(plain);
            if (answerOnly) {
                current.answer = normalizeAnswer(answerOnly[1]);
                inChoiceBlock = false;
                continue;
            }

            const statementMatch = STATEMENT_RE.exec(plain);
            if (statementMatch) {
                let content = normalized.replace(STATEMENT_PREFIX_RE, "").trim();
                const res = stripInlineAnswer(content);
                content = res[0];
                if (!current.answer && res[1]) current.answer = res[1];
                current.choices.push({ label: statementMatch[1].toLowerCase(), content });
                current.qtype = "true_false";
                lastChoice = current.choices[current.choices.length - 1];
                inChoiceBlock = true;
                continue;
            }

            const [statementPrefix, inlineStatements] = extractInlineStatements(normalized);
            if (inlineStatements.length > 0) {
                if (statementPrefix) {
                    current.stem = appendContent(current.stem, statementPrefix, line.kind !== "text");
                }
                for (const [label, rawContent] of inlineStatements) {
                    const res = stripInlineAnswer(rawContent);
                    const content = res[0];
                    if (!current.answer && res[1]) current.answer = res[1];
                    current.choices.push({ label, content });
                }
                current.qtype = "true_false";
                lastChoice = current.choices[current.choices.length - 1];
                inChoiceBlock = true;
                continue;
            }

            const inlineRes = extractInlineChoices(normalized);
            const prefix = inlineRes[0];
            const inlineChoices = inlineRes[1];

            if (inlineChoices.length > 0) {
                if (prefix) {
                    current.stem = appendContent(current.stem, prefix, line.kind !== "text");
                }
                for (const [label, content] of inlineChoices) {
                    current.choices.push({ label, content });
                }
                lastChoice = current.choices[current.choices.length - 1];
                inChoiceBlock = true;
                if (current.qtype === "short_answer") current.qtype = "single_choice";
                continue;
            }

            const cMatch = CHOICE_RE.exec(plain);
            if (cMatch) {
                const label = cMatch[1].toUpperCase();
                let content = normalized.replace(CHOICE_PREFIX_RE, "").trim();
                const res = stripInlineAnswer(content);
                content = res[0];
                current.choices.push({ label, content });
                lastChoice = current.choices[current.choices.length - 1];
                inChoiceBlock = true;
                if (current.qtype === "short_answer") current.qtype = "single_choice";
                continue;
            }

            if (inChoiceBlock && lastChoice && line.kind === "text") {
                lastChoice.content = appendContent(lastChoice.content, normalized, false);
                continue;
            }

            current.stem = appendContent(current.stem, normalized, line.kind !== "text");
            inChoiceBlock = false;
            continue;
        }

        instructionParts.push(normalized);
    }

    flushCurrent();

    // Fill missing answers from Answer Keys
    for (const q of questions) {
        if (q.answer) continue;
        const qnum = q.source_number ? q.source_number.toString() : null;
        if (!qnum) continue;
        q.answer = answerKeyPart[`${q.part_id}_${qnum}`] || answerKeyGlobal[qnum] || null;
    }

    return {
        title: "Imported exam",
        instruction: compactSpaces(instructionParts.join("\n")),
        questions: questions,
        assets: assets,
    };
}
