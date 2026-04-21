/**
 * Script tạo katex-minimal.css
 * Xử lý đúng minified CSS (1-line hoặc nhiều dòng)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const KATEX_CSS_SRC = path.join(ROOT, 'node_modules', 'katex', 'dist', 'katex.min.css');
const OUTPUT_CSS = path.join(ROOT, 'src', 'styles', 'katex-minimal.css');

// Font families CẦN xoá (không dùng trong đề thi THPTQG)
const FONT_FAMILIES_TO_REMOVE = [
  'KaTeX_Caligraphic',
  'KaTeX_Fraktur',
  'KaTeX_Typewriter',
  'KaTeX_Script',
  'KaTeX_SansSerif',
];

const FALLBACK_CSS = `

/* ============================================================
   katex-minimal.css — Safety Fallback
   
   Các font family dưới đây đã bị xoá để giảm bandwidth.
   Nếu đề thi có ký tự hiếm (\\mathcal, \\mathfrak, v.v.),
   chữ vẫn render được với KaTeX_Main (không bị □ ô vuông).
   ============================================================ */

/* KaTeX_Caligraphic fallback → KaTeX_Main */
.katex .mathcal { font-family: KaTeX_Main, serif; }

/* KaTeX_Fraktur fallback → KaTeX_Main */
.katex .mathfrak,
.katex .textfrak,
.katex .mathboldfrak,
.katex .textboldfrak { font-family: KaTeX_Main, serif; }

/* KaTeX_Typewriter fallback → KaTeX_Main */
.katex .mathtt,
.katex .texttt { font-family: KaTeX_Main, serif; }

/* KaTeX_Script fallback → KaTeX_Math */
.katex .mathscr,
.katex .textscr { font-family: KaTeX_Math, KaTeX_Main, serif; font-style: italic; }

/* KaTeX_SansSerif fallback → KaTeX_Main */
.katex .mathsf,
.katex .textsf,
.katex .mathboldsf,
.katex .textboldsf,
.katex .mathitsf,
.katex .textitsf { font-family: KaTeX_Main, serif; }
`;

/**
 * Xoá @font-face blocks từ CSS string (hỗ trợ cả minified và expanded)
 * Sử dụng character-level parser để tìm và xoá chính xác
 */
function removeUnusedFontFaceBlocks(css) {
  const result = [];
  let i = 0;
  let removedCount = 0;
  let keptCount = 0;

  while (i < css.length) {
    // Tìm @font-face
    const atIdx = css.indexOf('@font-face', i);
    
    if (atIdx === -1) {
      // Không còn @font-face nào nữa, giữ phần còn lại
      result.push(css.slice(i));
      break;
    }

    // Giữ nội dung trước @font-face
    result.push(css.slice(i, atIdx));
    
    // Tìm '{' mở đầu block
    const openBrace = css.indexOf('{', atIdx);
    if (openBrace === -1) {
      result.push(css.slice(atIdx));
      break;
    }

    // Parse đến '}' đóng block (tracking cả nested braces nếu có)
    let depth = 1;
    let j = openBrace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    // j bây giờ là vị trí sau '}' đóng block

    const blockContent = css.slice(atIdx, j);
    
    // Tìm font-family trong block
    const familyMatch = blockContent.match(/font-family\s*:\s*(['"]?)([^'";,\s\}]+)\1/);
    const familyName = familyMatch ? familyMatch[2] : '';
    
    const shouldRemove = FONT_FAMILIES_TO_REMOVE.some(f => familyName.startsWith(f));
    
    if (shouldRemove) {
      removedCount++;
      // Không push blockContent → block bị xoá
    } else {
      keptCount++;
      result.push(blockContent);
    }

    i = j;
  }

  console.log(`[katex-minimal] Removed ${removedCount} @font-face blocks (kept ${keptCount})`);
  return result.join('');
}

// Main
try {
  console.log('[katex-minimal] Reading katex.min.css...');
  let css = fs.readFileSync(KATEX_CSS_SRC, 'utf-8');
  console.log(`[katex-minimal] Original size: ${(css.length / 1024).toFixed(1)} KB`);
  console.log(`[katex-minimal] @font-face blocks: ${(css.match(/@font-face/g) || []).length}`);

  css = removeUnusedFontFaceBlocks(css);

  // Append fallback CSS
  css += FALLBACK_CSS;
  console.log(`[katex-minimal] Final size: ${(css.length / 1024).toFixed(1)} KB`);

  // Ensure output dir exists
  const outputDir = path.dirname(OUTPUT_CSS);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_CSS, css, 'utf-8');
  console.log(`[katex-minimal] ✅ Written to: ${OUTPUT_CSS}`);
} catch (err) {
  console.error('[katex-minimal] ❌ Error:', err.message);
  process.exit(1);
}
