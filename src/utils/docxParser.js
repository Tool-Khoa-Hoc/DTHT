import JSZip from 'jszip';

// Namespaces used in docx XML
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const V_NS = "urn:schemas-microsoft-com:vml";
const O_NS = "urn:schemas-microsoft-com:office:office";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

// Helper: resolve relations
function resolveRelTarget(target, zipFiles) {
  target = target.replace(/\\/g, '/').trim();
  if (!target) return "";

  const candidates = [
    target,
  ];
  if (!target.startsWith("word/")) {
    candidates.push(`word/${target}`);
  }
  if (target.startsWith("../")) {
    candidates.push(target.substring(3));
  }

  for (const candidate of candidates) {
    if (zipFiles[candidate]) {
      return candidate;
    }
  }
  return "";
}

// Generate simple hash for blob (replacement for hashlib.sha1)
async function getBlobHash(blob) {
  const hashBuffer = await crypto.subtle.digest('SHA-1', blob);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 12);
}

// Parse relationships from .rels file
async function readRels(zip) {
  const relMap = {};
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (!relsFile) return relMap;

  const relsXmlText = await relsFile.async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(relsXmlText, "application/xml");
  const rels = xmlDoc.getElementsByTagNameNS(REL_NS, "Relationship");
  
  const zipFiles = zip.files;

  for (let i = 0; i < rels.length; i++) {
    const rel = rels[i];
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) {
      const resolved = resolveRelTarget(target, zipFiles);
      if (resolved) {
        relMap[id] = resolved;
      }
    }
  }
  return relMap;
}

// OMML to LaTeX Converter (Ported from _omml_to_latex)
function localName(node) {
    return node ? node.localName : "";
}

function findChild(node, name) {
    if (!node) return null;
    for (let i = 0; i < node.childNodes.length; i++) {
        if (localName(node.childNodes[i]) === name) return node.childNodes[i];
    }
    return null;
}

function nodeVal(node) {
    if (!node) return "";
    return node.getAttributeNS(M_NS, "val") || node.getAttribute("val") || node.getAttribute("m:val") || "";
}

function wrapBase(base) {
    base = base.trim();
    if (!base) return "";
    if (base.length === 1 || base.startsWith("\\")) return base;
    return `{${base}}`;
}

function ommlToLatex(node) {
    function render(elem) {
        if (!elem) return "";
        const name = localName(elem);

        if (name === "t") return elem.textContent || "";
        if (["oMath", "oMathPara", "r", "e", "num", "den", "sub", "sup", "deg", "sPre", "sSubSupPr"].includes(name)) {
            return Array.from(elem.childNodes).map(render).join('');
        }
        if (name === "f") {
            const num = render(findChild(elem, "num"));
            const den = render(findChild(elem, "den"));
            return `\\frac{${num}}{${den}}`;
        }
        if (name === "sSup") {
            const base = render(findChild(elem, "e"));
            const sup = render(findChild(elem, "sup"));
            return `${wrapBase(base)}^{${sup}}`;
        }
        if (name === "sSub") {
            const base = render(findChild(elem, "e"));
            const sub = render(findChild(elem, "sub"));
            return `${wrapBase(base)}_{${sub}}`;
        }
        if (name === "sSubSup") {
            const base = render(findChild(elem, "e"));
            const sub = render(findChild(elem, "sub"));
            const sup = render(findChild(elem, "sup"));
            return `${wrapBase(base)}_{${sub}}^{${sup}}`;
        }
        if (name === "rad") {
            const base = render(findChild(elem, "e"));
            const deg = render(findChild(elem, "deg"));
            if (deg) return `\\sqrt[${deg}]{${base}}`;
            return `\\sqrt{${base}}`;
        }
        if (name === "d") {
            const dpr = findChild(elem, "dPr");
            const beg = nodeVal(findChild(dpr, "begChr")) || "(";
            const end = nodeVal(findChild(dpr, "endChr")) || ")";
            const body = render(findChild(elem, "e"));
            return `\\left${beg}${body}\\right${end}`;
        }
        if (name === "nary") {
            const naryPr = findChild(elem, "naryPr");
            const op = nodeVal(findChild(naryPr, "chr")) || "\\sum";
            const opMap = { "∑": "\\sum", "∏": "\\prod", "∫": "\\int" };
            const opLatex = opMap[op] || op;
            const sub = render(findChild(elem, "sub"));
            const sup = render(findChild(elem, "sup"));
            const body = render(findChild(elem, "e"));
            if (sub || sup) return `${opLatex}_{${sub}}^{${sup}} ${body}`.trim();
            return `${opLatex} ${body}`.trim();
        }
        if (name === "func") {
            const fname = render(findChild(elem, "fName"));
            const farg = render(findChild(elem, "e"));
            return `${fname}${farg}`;
        }
        if (name === "fName") {
            return Array.from(elem.childNodes).map(render).join('');
        }
        // Fallback
        return Array.from(elem.childNodes).map(render).join('');
    }

    let latex = render(node);
    latex = latex.replace(/\s+/g, ' ').trim();
    return latex || "\\text{}";
}

// Extract MTEF from OLE Object (CFB Stream)
const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function readSector(blob, sector, sectorSize) {
    const offset = (sector + 1) * sectorSize;
    return new Uint8Array(blob.slice(offset, offset + sectorSize));
}

function iterChain(start, fat) {
    const out = [];
    let cur = start;
    const seen = new Set();
    const FREESECT = 0xFFFFFFFF;
    const ENDOFCHAIN = 0xFFFFFFFE;
    while (cur !== FREESECT && cur !== ENDOFCHAIN && cur >= 0) {
        if (seen.has(cur) || cur >= fat.length) break;
        out.push(cur);
        seen.add(cur);
        cur = fat[cur];
    }
    return out;
}

function readCfbStream(blob, streamName) {
    if (blob.byteLength < 512) return null;
    const header = new Uint8Array(blob, 0, 8);
    for (let i=0; i<8; i++) {
        if (header[i] !== CFB_SIGNATURE[i]) return null;
    }

    const view = new DataView(blob);
    const sectorShift = view.getUint16(0x1E, true);
    const miniSectorShift = view.getUint16(0x20, true);
    const sectorSize = 1 << sectorShift;
    const miniSectorSize = 1 << miniSectorShift;
    const numFat = view.getUint32(0x2C, true);
    const firstDirSector = view.getUint32(0x30, true);
    const miniCutoff = view.getUint32(0x38, true);
    const firstMinifatSector = view.getUint32(0x3C, true);
    const numMinifatSectors = view.getUint32(0x40, true);

    const difat = [];
    for (let i = 0; i < 109; i++) {
        difat.push(view.getUint32(0x4C + i * 4, true));
    }

    const FREESECT = 0xFFFFFFFF;
    const ENDOFCHAIN = 0xFFFFFFFE;
    const fatSectors = difat.filter(s => s !== FREESECT && s !== ENDOFCHAIN).slice(0, numFat);
    
    const fat = [];
    for (const fs of fatSectors) {
        const sectorData = readSector(blob, fs, sectorSize);
        const sectorView = new DataView(sectorData.buffer);
        for (let i = 0; i < sectorSize / 4; i++) {
            fat.push(sectorView.getUint32(i * 4, true));
        }
    }

    const miniFat = [];
    if (firstMinifatSector !== FREESECT && firstMinifatSector !== ENDOFCHAIN && numMinifatSectors) {
        const chain = iterChain(firstMinifatSector, fat).slice(0, numMinifatSectors);
        for (const s of chain) {
            const sectorData = readSector(blob, s, sectorSize);
            const sectorView = new DataView(sectorData.buffer);
            for (let i = 0; i < sectorSize / 4; i++) {
                miniFat.push(sectorView.getUint32(i * 4, true));
            }
        }
    }

    const dirChain = iterChain(firstDirSector, fat);
    const dirBytesArr = [];
    for (const s of dirChain) {
        dirBytesArr.push(readSector(blob, s, sectorSize));
    }
    const dirBytesLength = dirBytesArr.reduce((acc, val) => acc + val.length, 0);
    const dirBytes = new Uint8Array(dirBytesLength);
    let offset = 0;
    for (const arr of dirBytesArr) {
        dirBytes.set(arr, offset);
        offset += arr.length;
    }
    const dirView = new DataView(dirBytes.buffer);

    let streamStart = null;
    let streamSize = 0;
    let rootStart = null;
    let rootSize = 0;

    for (let off = 0; off < dirBytes.length; off += 128) {
        if (off + 128 > dirBytes.length) break;
        const nameLen = dirView.getUint16(off + 64, true);
        if (nameLen < 2) continue;
        
        let nameChars = [];
        for (let i = 0; i < nameLen - 2; i += 2) {
            nameChars.push(dirView.getUint16(off + i, true));
        }
        const name = String.fromCharCode(...nameChars);
        const objType = dirBytes[off + 66];
        const startSector = dirView.getUint32(off + 116, true);
        // Note: JS only supports 32 bit exact integer accurately, for OLE this usually fits in 32.
        const size = dirView.getUint32(off + 120, true);

        if (objType === 5 && name === "Root Entry") {
            rootStart = startSector;
            rootSize = size;
        }
        if (objType === 2 && name === streamName) {
            streamStart = startSector;
            streamSize = size;
        }
    }

    if (streamStart === null) return null;

    if (streamSize >= miniCutoff) {
        const chain = iterChain(streamStart, fat);
        let outArr = new Uint8Array(streamSize);
        let o = 0;
        for (const s of chain) {
            const sec = readSector(blob, s, sectorSize);
            const toCopy = Math.min(sec.length, streamSize - o);
            outArr.set(sec.slice(0, toCopy), o);
            o += toCopy;
            if (o >= streamSize) break;
        }
        return outArr;
    }

    if (rootStart === null) return null;

    const rootChain = iterChain(rootStart, fat);
    const miniStream = new Uint8Array(rootSize);
    let mOff = 0;
    for (const s of rootChain) {
        const sec = readSector(blob, s, sectorSize);
        const Math_min = Math.min(sec.length, rootSize - mOff);
        miniStream.set(sec.slice(0, Math_min), mOff);
        mOff += Math_min;
        if (mOff >= rootSize) break;
    }

    const scChain = iterChain(streamStart, miniFat);
    const outArr = new Uint8Array(streamSize);
    let outOff = 0;
    for (const s of scChain) {
        const start = s * miniSectorSize;
        const sec = miniStream.slice(start, start + miniSectorSize);
        const toCopy = Math.min(sec.length, streamSize - outOff);
        outArr.set(sec.slice(0, toCopy), outOff);
        outOff += toCopy;
        if (outOff >= streamSize) break;
    }
    return outArr;
}

function extractMtefCandidate(eqBytes) {
    let chars = [];
    let i = 0;
    while (i < eqBytes.length - 1) {
        const b = eqBytes[i];
        const n = eqBytes[i + 1];
        
        if ((b === 0x81 || b === 0x83 || b === 0x86 || b === 0x88 || b === 0x96) && i + 2 < eqBytes.length) {
            const code = eqBytes[i+1] + (eqBytes[i+2] << 8);
            if (code === 0x2212) {
                chars.push("-");
                i += 3;
                continue;
            }
        }
        
        if ((b === 0x81 || b === 0x83 || b === 0x88 || b === 0x96) && (n >= 32 && n <= 126 && n !== 34)) {
            chars.push(String.fromCharCode(n));
            i += 2;
            continue;
        }
        if (b === 0x86) {
            if (n === 0xD7) {
                chars.push("×");
                i += 2;
                continue;
            }
            if (n >= 32 && n <= 126 && n !== 34) {
                chars.push(String.fromCharCode(n));
                i += 2;
                continue;
            }
            let chosen = null;
            if (i + 4 < eqBytes.length) {
                for (let k = 2; k <= 4; k++) {
                    const x = eqBytes[i + k];
                    if (x >= 32 && x <= 126 && x !== 34) {
                        chosen = x;
                        break;
                    }
                }
            }
            if (chosen !== null) {
                chars.push(String.fromCharCode(chosen));
                i += 2;
                continue;
            }
        }
        i += 1;
    }
    return chars.join("").trim();
}

function formatGenotypeSide(raw) {
    if (!raw) return "";
    const fracMatch = /^([A-Z]{2,})([a-z]{2,})([A-Za-z]*)$/.exec(raw);
    if (fracMatch && fracMatch[1].length === fracMatch[2].length) {
        const head = `\\dfrac{${fracMatch[1]}}{${fracMatch[2]}}`;
        const tail = fracMatch[3];
        if (tail) return (head + " " + formatGenotypeSide(tail)).trim();
        return head;
    }
    if (!raw.includes("X") && !raw.includes("Y")) return raw;

    const tokens = [];
    let i = 0;
    while (i < raw.length) {
        const ch = raw[i];
        if (ch === "X") {
            if (i + 1 < raw.length && "AaBbCcDdEe".includes(raw[i+1])) {
                tokens.push(`X^{${raw[i + 1]}}`);
                i += 2;
                continue;
            }
            tokens.push("X");
            i += 1;
            continue;
        }
        if (ch === "Y") {
            tokens.push("Y");
            i += 1;
            continue;
        }
        let j = i;
        while (j < raw.length && raw[j] !== "X" && raw[j] !== "Y") j++;
        const chunk = raw.substring(i, j);
        if (chunk) tokens.push(chunk);
        i = j;
    }
    return tokens.join(" ");
}

function candidateToLatex(candidate) {
    const c = candidate.trim();
    if (!c) return "";
    if (c === "%") return "\\%";
    if (c.includes("×")) {
        const sides = c.split("×").map(s => formatGenotypeSide(s.trim()));
        return sides.filter(s => s).join(" \\times ");
    }
    return formatGenotypeSide(c);
}

function extractMathFromOle(blob, mathId) {
    const eqBytes = readCfbStream(blob.buffer, "Equation Native");
    if (!eqBytes) return [`\\text{${mathId}}`, "ole_placeholder"];
    
    const candidate = extractMtefCandidate(eqBytes);
    const latex = candidateToLatex(candidate);
    if (latex) return [latex, "ole_mtef"];
    return [`\\text{${mathId}}`, "ole_placeholder"];
}

// Helper to reliably check child namespaces
function selectNodesNS(root, localName, nsURI) {
    return Array.from(root.getElementsByTagNameNS(nsURI, localName));
}

// Main parser function
export async function parseDocx(fileBlob) {
    const lines = [];
    const assets = { images: {}, math: {} };
    const seenImg = new Set();
    const seenMath = new Set();
    
    // Unzip the file
    const zip = new JSZip();
    await zip.loadAsync(fileBlob);
    
    if (!zip.file("word/document.xml")) {
        throw new Error("Invalid .docx: missing word/document.xml");
    }

    const relMap = await readRels(zip);
    const zipFileContents = {};

    const docXmlStr = await zip.file("word/document.xml").async("string");
    const parser = new DOMParser();
    const docXml = parser.parseFromString(docXmlStr, "application/xml");

    function normalizeMultilineText(value) {
        return String(value || "")
            .replace(/\u00a0/g, " ")
            .replace(/\r/g, "")
            .split("\n")
            .map((line) => line.replace(/[ \t]+/g, " ").trim())
            .filter(Boolean)
            .join("\n");
    }

    function wrapStyledText(text, rPr) {
        const value = String(text || "");
        if (!value || !rPr) return value;
        let token = "";
        if (findChild(rPr, "b")) token = "b";
        if (findChild(rPr, "i")) token = "i";
        const vertAlign = findChild(rPr, "vertAlign");
        if (vertAlign) {
            const vVal = nodeVal(vertAlign);
            if (vVal === "subscript") token = "sub";
            if (vVal === "superscript") token = "sup";
        }
        return token ? `[!${token}:$${value}$]` : value;
    }

    async function extractMathTokensFromElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return [];

        const mathNodes =
            element.namespaceURI === M_NS && (element.localName === "oMath" || element.localName === "oMathPara")
                ? [element]
                : Array.from(element.getElementsByTagNameNS(M_NS, "oMath")).concat(
                      Array.from(element.getElementsByTagNameNS(M_NS, "oMathPara"))
                  );

        const tokens = [];
        for (const omath of mathNodes) {
            const serializer = new XMLSerializer();
            const rawXmlStr = serializer.serializeToString(omath);
            const rawBuffer = new TextEncoder().encode(rawXmlStr);
            const hid = await getBlobHash(rawBuffer);
            const mathId = `mathtype_${hid}`;

            if (!seenMath.has(hid)) {
                const latex = ommlToLatex(omath);
                assets.math[mathId] = {
                    math: latex,
                    source: "omml",
                };
                seenMath.add(hid);
                tokens.push(`[math:$${latex}$]`);
            } else {
                tokens.push(`[math:$${assets.math[mathId]?.math || ommlToLatex(omath)}$]`);
            }
        }
        if (tokens.length) return tokens;

        const oleObjects = Array.from(element.getElementsByTagNameNS(O_NS, "OLEObject"));
        for (const oleObj of oleObjects) {
            const rid = oleObj.getAttributeNS(R_NS, "id") || oleObj.getAttribute("id");
            const progId = oleObj.getAttribute("ProgID") || "";

            const target = relMap[rid || ""];
            if (!target || !zip.file(target)) continue;
            if (progId && !/(mathtype|equation|dsmt)/i.test(progId)) continue;

            const blobBytes = await zip.file(target).async("uint8array");
            const hid = await getBlobHash(blobBytes);
            const mathId = `mathtype_${hid}`;
            let latex = assets.math[mathId]?.math || "";

            if (!seenMath.has(hid)) {
                const [resolvedLatex, source] = extractMathFromOle(blobBytes, mathId);
                latex = resolvedLatex;
                assets.math[mathId] = { math: latex, source: source };
                seenMath.add(hid);
            }
            tokens.push(`[math:$${latex || assets.math[mathId]?.math || mathId}$]`);
        }
        return tokens;
    }

    async function extractImageTokensFromElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return [];

        const tokens = [];
        const drawingNodes = Array.from(element.getElementsByTagNameNS(W_NS, "drawing"));
        for (const drawing of drawingNodes) {
            const blips = drawing.getElementsByTagNameNS(A_NS, "blip");
            for (const blip of blips) {
                const rid =
                    blip.getAttributeNS(R_NS, "embed") ||
                    blip.getAttribute("embed") ||
                    blip.getAttribute("r:embed");
                const target = relMap[rid || ""];
                if (!target || !zip.file(target)) continue;

                const blobBytes = await zip.file(target).async("uint8array");
                const hid = await getBlobHash(blobBytes);
                const ext = target.split(".").pop() || "bin";
                const imageId = `img_${hid}`;

                if (!seenImg.has(hid)) {
                    const base64Str = await zip.file(target).async("base64");
                    let mime = "image/png";
                    if (ext === "jpeg" || ext === "jpg") mime = "image/jpeg";
                    if (ext === "gif") mime = "image/gif";
                    if (ext === "svg") mime = "image/svg+xml";

                    assets.images[imageId] = {
                        source: `data:${mime};base64,${base64Str}`,
                        ext: ext,
                    };
                    seenImg.add(hid);
                }
                tokens.push(`[img:$${imageId}$]`);
            }
        }

        const vmlImages = Array.from(element.getElementsByTagNameNS(V_NS, "imagedata"));
        for (const vmlImg of vmlImages) {
            const rid = vmlImg.getAttributeNS(R_NS, "id") || vmlImg.getAttribute("r:id");
            const target = relMap[rid || ""];
            if (!target || !zip.file(target)) continue;

            const blobBytes = await zip.file(target).async("uint8array");
            const hid = await getBlobHash(blobBytes);
            const ext = target.split(".").pop() || "bin";
            const imageId = `img_${hid}`;

            if (!seenImg.has(hid)) {
                const base64Str = await zip.file(target).async("base64");
                let mime = "image/png";
                if (ext === "jpeg" || ext === "jpg") mime = "image/jpeg";

                assets.images[imageId] = {
                    source: `data:${mime};base64,${base64Str}`,
                    ext: ext,
                };
                seenImg.add(hid);
            }
            tokens.push(`[img:$${imageId}$]`);
        }

        return tokens;
    }

    async function processRun(run) {
        const parts = [];
        let textBuffer = "";

        function flushText() {
            if (!textBuffer) return;
            const rPr = findChild(run, "rPr");
            parts.push(wrapStyledText(textBuffer, rPr));
            textBuffer = "";
        }

        for (const child of Array.from(run.childNodes || [])) {
            if (child.nodeType !== Node.ELEMENT_NODE) continue;
            if (child.namespaceURI === W_NS && child.localName === "t") {
                textBuffer += child.textContent || "";
                continue;
            }
            if (child.namespaceURI === W_NS && child.localName === "tab") {
                textBuffer += " ";
                continue;
            }
            if (child.namespaceURI === W_NS && (child.localName === "br" || child.localName === "cr")) {
                textBuffer += "\n";
                continue;
            }

            const mathTokens = await extractMathTokensFromElement(child);
            if (mathTokens.length) {
                flushText();
                parts.push(...mathTokens);
                continue;
            }

            const imageTokens = await extractImageTokensFromElement(child);
            if (imageTokens.length) {
                flushText();
                parts.push(...imageTokens);
            }
        }

        flushText();
        return parts;
    }

    async function processParagraphNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return [];
        if (node.namespaceURI === W_NS && node.localName === "r") {
            return processRun(node);
        }

        const mathTokens = await extractMathTokensFromElement(node);
        if (mathTokens.length) return mathTokens;

        const imageTokens = await extractImageTokensFromElement(node);
        if (imageTokens.length) return imageTokens;

        const parts = [];
        for (const child of Array.from(node.childNodes || [])) {
            parts.push(...(await processParagraphNode(child)));
        }
        return parts;
    }
    
    async function processParagraph(p) {
        const parts = [];
        for (const child of Array.from(p.childNodes || [])) {
            parts.push(...(await processParagraphNode(child)));
        }
        
        return normalizeMultilineText(parts.join(""));
    }

    async function processTable(tbl) {
        const rows = tbl.getElementsByTagNameNS(W_NS, "tr");
        const tableLines = [];
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const cells = row.getElementsByTagNameNS(W_NS, "tc");
            const rowCellsText = [];
            for (let c = 0; c < cells.length; c++) {
                const cell = cells[c];
                const cellLines = [];
                // Find all paragraphs directly or deeply inside the cell
                const cellParagraphs = cell.getElementsByTagNameNS(W_NS, "p");
                for (let cp = 0; cp < cellParagraphs.length; cp++) {
                    const pText = await processParagraph(cellParagraphs[cp]);
                    if (pText) cellLines.push(pText);
                }
                const cellContent = cellLines
                    .map((entry) => String(entry || "").replace(/\n/g, " [br] "))
                    .join(" [br] ")
                    .replace(/\|/g, "\\|");
                rowCellsText.push(cellContent);
            }
            tableLines.push(`[* ${rowCellsText.join(" | ")} *]`);
        }
        return tableLines;
    }

    async function traverse(node) {
        if (node.namespaceURI === W_NS && node.localName === "p") {
            const line = await processParagraph(node);
            if (line) lines.push(line);
            return;
        }
        if (node.namespaceURI === W_NS && node.localName === "tbl") {
            const tLines = await processTable(node);
            lines.push(...tLines);
            return;
        }
        const children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === 1) { // ELEMENT_NODE
                await traverse(child);
            }
        }
    }

    const bodyNodes = docXml.getElementsByTagNameNS(W_NS, "body");
    if (bodyNodes.length > 0) {
        await traverse(bodyNodes[0]);
    }

    return { lines, assets };
}
