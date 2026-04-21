# Kế hoạch Tối ưu Hiệu năng Web

## Phân tích vấn đề

Sau khi phân tích bundle build và toàn bộ codebase, đây là các vấn đề hiệu năng được xác định:

### 📊 Bundle Size Hiện Tại (gzip)
| Chunk | Gzip Size | Vấn đề |
|---|---|---|
| `pdf.worker.min.mjs` | **399 kB** | Luôn được bundle, cực nặng |
| `vendor-pdf` (react-pdf + pdfjs-dist) | **103 kB** | Load ngay khi vào trang |
| `vendor-katex` | **85 kB** | Load ngay khi vào trang |
| `vendor-react` | **73 kB** | Bắt buộc, không tối ưu thêm được |
| `vendor-supabase` | **46 kB** | Bắt buộc, không tối ưu thêm được |
| KaTeX fonts | **~300 kB** (tổng) | Nhiều font không dùng |
| `Admin.js` | **17.7 kB** | 82 kB raw — file quá lớn |

### 🔍 Thư viện không sử dụng hoặc có thể loại bỏ

| Thư viện | Trạng thái | Chi tiết |
|---|---|---|
| `lucide-react` | ❌ **Không dùng** | Không có file nào import từ `lucide-react` |
| `dotenv` | ❌ **Không dùng ở client** | Chỉ dùng trong Vite config tự động, không cần trong dependencies |
| `react-katex` | ❌ **Không dùng** | Code dùng `katex` trực tiếp, `react-katex` không được import ở đâu |
| `@vercel/speed-insights` | ⚠️ Giữ lại | Đang dùng trong App.jsx |
| `swr` | ✅ Đang dùng | Dùng trong AuthContext.jsx |
| `katex` | ✅ Đang dùng | Dùng trong RichTextRenderer.jsx |
| `pdfjs-dist` + `react-pdf` | ✅ Đang dùng | Dùng trong SecurePdfViewer.jsx |

---

## Proposed Changes

### Phase 1: Xoá thư viện không dùng (Tác động lớn nhất, rủi ro thấp nhất)

#### [MODIFY] package.json
- Xoá `lucide-react` (~6-8 kB gzip khỏi bundle nếu còn bị bundle)
- Xoá `react-katex` (dependency thừa, không dùng)
- Xoá `dotenv` khỏi `dependencies` (môi trường browser không cần — Vite tự xử lý biến env)

```bash
npm uninstall lucide-react react-katex dotenv
```

---

### Phase 2: Tree-shaking KaTeX Fonts (Quan trọng — ~200 kB saved)

**Vấn đề:** KaTeX bundle toàn bộ 20 font family (30+ file font: `.woff`, `.woff2`, `.ttf`).
Ứng dụng chủ yếu render toán học + hóa học (`mhchem`) cho học sinh THPTQG.

#### Phân tích — Font nào cần, font nào bỏ được?

| Font Family | Kích thước (woff2) | Dùng bởi CSS class | Cần? |
|---|---|---|---|
| `KaTeX_Main` (4 variant) | ~95 kB | Mọi thứ — chữ số, toán tử, text | ✅ GIỮ |
| `KaTeX_Math` (2 variant) | ~33 kB | `.mathnormal` — biến toán như *x*, *y*, *θ* | ✅ GIỮ |
| `KaTeX_AMS` | ~28 kB | Ký hiệu ∑ ∫ ∂ ∀ ∃ ∈ → ≠ ± | ✅ GIỮ |
| `KaTeX_Size1–4` (4 font) | ~20 kB | Ngoặc lớn `( )`, phân số, tích phân | ✅ GIỮ |
| `KaTeX_Caligraphic` (2 variant) | ~14 kB | `.mathcal` — chữ *𝒜ℬ* (LaTeX `\mathcal`) | ❌ XOÁ |
| `KaTeX_Fraktur` (2 variant) | ~23 kB | `.mathfrak` — chữ Gothic 𝔄𝔅 | ❌ XOÁ |
| `KaTeX_Typewriter` | ~14 kB | `.texttt` — `\mathtt{abc}` | ❌ XOÁ |
| `KaTeX_Script` | ~10 kB | `.mathscr` — chữ cursive ℒ | ❌ XOÁ |
| `KaTeX_SansSerif` (3 variant) | ~35 kB | `.mathsf` — `\mathsf{abc}` | ❌ XOÁ |

> **Xác nhận codebase:** Tìm kiếm toàn bộ `src/` → **không có** `\mathcal`, `\mathfrak`, `\mathsf`, `\mathtt`, `\mathscr` nào. An toàn để bỏ 5 font family trên.

**Ước tính tiết kiệm:** ~120 kB font files không tải + chunk `vendor-katex` nhẹ hơn

---

#### Cách thực hiện an toàn — KHÔNG copy-paste CSS thủ công

**Chiến lược:** Tạo `src/styles/katex-minimal.css` theo 2 bước:

**Bước A — Giữ nguyên toàn bộ CSS rules** (class `.katex`, `.mspace`, `.strut`, v.v.) từ `katex.min.css` — chỉ xoá các block `@font-face` của font không cần.

**Bước B — Thêm CSS fallback** để nếu LaTeX ngoài dự kiến có dùng font đã xoá, nó sẽ fallback về `KaTeX_Main` thay vì hiển thị ô vuông.

#### [MODIFY] `src/components/exam/RichTextRenderer.jsx`

```diff
-import 'katex/dist/katex.min.css';
+import '../../styles/katex-minimal.css';
```

#### [NEW] `src/styles/katex-minimal.css`

Nội dung file gồm **2 phần**:

**Phần 1: Import toàn bộ CSS rules của KaTeX** (không thay đổi layout, spacing, render logic)
```css
/* Tất cả CSS rules từ katex.min.css — KHÔNG bao gồm các @font-face thừa */
/* Được tạo bằng cách copy nội dung katex.min.css, sau đó xoá các @font-face blocks:
   KaTeX_Caligraphic, KaTeX_Fraktur, KaTeX_Typewriter, KaTeX_Script, KaTeX_SansSerif */
```

**Phần 2: Fallback font-family** — phòng trường hợp content có `\mathcal`, `\mathfrak`, v.v.:
```css
/* Safety fallback: nếu content có dùng font đã xoá, render bằng KaTeX_Main thay vì □ */
.katex .mathcal,
.katex .mathfrak, .katex .textfrak, .katex .mathboldfrak, .katex .textboldfrak,
.katex .texttt,
.katex .mathscr, .katex .textscr,
.katex .mathsf, .katex .textsf, .katex .mathboldsf, .katex .textboldsf {
  font-family: KaTeX_Main, serif; /* Graceful fallback — chữ vẫn hiện, chỉ khác style */
}
```

> [!IMPORTANT]
> Phần 2 là bắt buộc để đảm bảo **không bị ô vuông □** nếu đề thi có ký tự hiếm. Chữ sẽ vẫn render được (dùng font Main), chỉ là không đúng style Fraktur/Script — tốt hơn nhiều so với lỗi.

#### Script tạo file (thực hiện tự động)

Sau khi approve plan, tôi sẽ chạy Node.js script để:
1. Đọc `node_modules/katex/dist/katex.min.css` (~23 kB)
2. Dùng regex để bỏ các `@font-face` block của 5 font family cần xoá
3. Thêm CSS fallback vào cuối
4. Ghi ra `src/styles/katex-minimal.css`

Không cần copy-paste thủ công → không có nguy cơ thiếu quy tắc CSS.

---

### Phase 3: Lazy Load PDF Worker Ngoài Main Bundle (Quan trọng — 400 kB defer)

**Vấn đề:** `pdf.worker.min.mjs` (1,37 MB raw / 400 kB brotli) hiện tại được Vite bundle vào chunk PDF. Mặc dù đã có code lazy init, worker file vẫn **được kéo vào build** và server phải gửi nó ngay khi user vào `/exam/:id/result`.

#### [MODIFY] `vite.config.js`
Cấu hình để `pdf.worker.min.mjs` được serve từ CDN thay vì bundle:

```js
// TRONG SecurePdfViewer.jsx
// Thay vì:
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// Dùng CDN trực tiếp:
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
```

> [!IMPORTANT]
> Cần test kỹ: CDN này phải accessible từ Việt Nam. Nếu bị block, cần giữ local bundle.

#### [MODIFY] `src/components/exam/SecurePdfViewer.jsx`
Cập nhật fallback CDN từ `unpkg.com` (chậm ở Việt Nam) sang `cdnjs.cloudflare.com` (nhanh hơn).

---

### Phase 4: Tối ưu RichTextRenderer — Memoization (Performance runtime)

**Vấn đề:** `RichTextRenderer` là component nặng (565 dòng), chứa nhiều function được tạo lại mỗi lần render. File `ExamResult.jsx` có nhiều `useState` triggers có thể gây re-render RichTextRenderer.

#### [MODIFY] `src/components/exam/RichTextRenderer.jsx`
- Wrap component với `React.memo()` để tránh re-render không cần thiết
- Move các hàm helper ra ngoài component (chúng không phụ thuộc props/state)

---

### Phase 5: Tối ưu AuthContext — Xoá SWR (Optional, bàn thêm)

**Vấn đề:** `swr` (~10 kB gzip) được dùng chỉ tại 1 chỗ duy nhất trong `AuthContext.jsx` để fetch profile. Có thể thay bằng `useReducer` + `useEffect` thuần để loại bỏ dependency.

> [!WARNING]
> **Cần xác nhận từ bạn:** `swr` mang lại một số lợi ích (deduplication, revalidation on reconnect). Nếu giữ lại thì không sao — chỉ tiết kiệm ~10 kB gzip. Tôi sẽ **bỏ qua phase này** nếu bạn không muốn.

---

### Phase 6: Tối ưu Vite Config — Thêm `treeshake` và tối ưu chunks

#### [MODIFY] `vite.config.js`
- Bật `build.minify: 'esbuild'` (nhanh hơn terser)
- Thêm `build.target: 'es2020'` để tận dụng các tính năng modern
- Tách `mhchem` plugin của KaTeX thành chunk riêng (vì chỉ dùng ở exam)

---

## Tóm tắt tác động ước tính

| Thay đổi | Tiết kiệm (transfer) | Rủi ro |
|---|---|---|
| Xoá `lucide-react`, `react-katex`, `dotenv` | ~0-10 kB (nếu đã tree-shaken) | Thấp |
| Tối ưu KaTeX fonts | ~100-200 kB (font files) | Thấp — cần kiểm tra visual |
| PDF Worker → CDN | ~400 kB brotli defer | Trung bình — phụ thuộc CDN |
| Memoize RichTextRenderer | Không giảm transfer, giảm CPU | Thấp |

## Open Questions

> [!IMPORTANT]
> **Q1:** Bạn có muốn loại bỏ `swr` không? Có thể thay bằng code thuần React, tiết kiệm ~10 kB nhưng cần viết lại logic cache/dedup trong AuthContext.

> [!IMPORTANT]
> **Q2:** PDF Worker CDN — Bạn có muốn thử dùng CDN (cdnjs.cloudflare) để giảm 400 kB từ server không? Cần test xem CDN có accessible tốt từ Việt Nam không.

> [!WARNING]
> **Q3:** KaTeX fonts nâng cao (Fraktur, Caligraphic, Typewriter) — Đề thi của bạn có dùng các ký tự đặc biệt này không? Nếu không thì có thể xoá hoàn toàn.

## Verification Plan

### Sau mỗi phase:
1. Chạy `npm run build` và so sánh bundle sizes
2. Chạy `npm run dev` và kiểm tra trang exam + exam result hoạt động đúng
3. Kiểm tra KaTeX render đúng công thức toán học
4. Kiểm tra PDF viewer load được file test
