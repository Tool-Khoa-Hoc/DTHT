import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

/**
 * TASK 4 — PDF Worker Async Init
 *
 * VẤN ĐỀ CŨ:
 *   `pdfjs.GlobalWorkerOptions.workerSrc = new URL(...)` ở top-level
 *   → chạy khi module được import → block Main Thread parse 1.37MB worker.
 *
 * GIẢI PHÁP:
 *   - Dùng singleton Promise — chỉ init 1 lần duy nhất
 *   - `new URL(..., import.meta.url)` vẫn dùng để Vite bundle đúng chunk
 *   - Worker thực sự chạy trong Web Worker thread riêng (không block Main Thread)
 *   - `initPdfWorker()` chỉ được gọi khi component mount → lazy
 */
let workerInitPromise = null;

function initPdfWorker() {
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = new Promise((resolve) => {
    try {
      // Ưu tiên dùng unpkg CDN để giảm tải băng thông server local và tận dụng cache
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      resolve();
    } catch (err) {
      console.warn('[SecurePdfViewer] CDN worker init failed, falling back to local fallback', err?.message);
      // Fallback
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      resolve();
    }
  });

  return workerInitPromise;
}

const pdfOptions = {
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
    cMapPacked: true,
};

const PAGE_ASPECT_RATIO = 1.414;
const INITIAL_VISIBLE_PAGES = 2;
const INTERSECTION_ROOT_MARGIN = '1200px 0px';

function isPdfWorkerCleanupError(error) {
    const message = String(error?.message || '');
    return (
        message.includes('sendWithPromise') ||
        message.includes('worker') ||
        message.includes('destroyed')
    );
}

class PdfErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        if (isPdfWorkerCleanupError(error)) {
            return { hasError: true };
        }

        throw error;
    }

    componentDidCatch(error) {
        console.warn('[SecurePdfViewer] Suppressed PDF worker error during cleanup:', error?.message);
    }

    render() {
        if (this.state.hasError) {
            return null;
        }

        return this.props.children;
    }
}

const PdfPageItem = React.memo(function PdfPageItem({
    pageNumber,
    width,
    devicePixelRatio,
    watermarkText,
}) {
    const [shouldRenderPage, setShouldRenderPage] = useState(pageNumber <= INITIAL_VISIBLE_PAGES);
    const pageRef = useRef(null);

    useEffect(() => {
        if (shouldRenderPage) {
            return undefined;
        }

        if (typeof IntersectionObserver !== 'function') {
            setShouldRenderPage(true);
            return undefined;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setShouldRenderPage(true);
                observer.disconnect();
            }
        }, { rootMargin: INTERSECTION_ROOT_MARGIN });

        if (pageRef.current) {
            observer.observe(pageRef.current);
        }

        return () => observer.disconnect();
    }, [shouldRenderPage]);

    const placeholderHeight = Math.max(480, Math.round(width * PAGE_ASPECT_RATIO));

    return (
        <div
            ref={pageRef}
            className="group relative overflow-hidden rounded-lg bg-white shadow-2xl shadow-black/80 ring-1 ring-white/10"
            style={{ width: `${width}px`, minHeight: `${placeholderHeight}px`, maxWidth: '100%' }}
        >
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden px-6 opacity-[0.1]">
                <h1 className="whitespace-nowrap text-black opacity-50 mix-blend-multiply transform -rotate-45 font-black leading-none" style={{ fontSize: 'clamp(34px, 5.8vw, 68px)' }}>
                    {watermarkText}
                </h1>
            </div>

            {shouldRenderPage ? (
                <Page
                    pageNumber={pageNumber}
                    width={width}
                    devicePixelRatio={devicePixelRatio}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="bg-white"
                    loading={
                        <div className="flex items-center justify-center bg-slate-100" style={{ height: `${placeholderHeight}px` }}>
                            <span className="material-symbols-outlined animate-spin text-3xl text-slate-400">autorenew</span>
                        </div>
                    }
                />
            ) : (
                <div className="flex flex-col items-center justify-center gap-3 bg-slate-100 text-slate-400" style={{ height: `${placeholderHeight}px` }}>
                    <span className="material-symbols-outlined text-3xl">picture_as_pdf</span>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em]">Trang {pageNumber}</p>
                </div>
            )}
        </div>
    );
});

export default function SecurePdfViewer({ url, userEmail, userName }) {
    const [numPages, setNumPages] = useState(null);
    const [width, setWidth] = useState(800);
    // TASK 4: Track whether PDF worker is initialized before rendering Document
    const [workerReady, setWorkerReady] = useState(false);
    const containerRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        // TASK 4: Init worker lazily on first mount — runs in Web Worker thread
        initPdfWorker().then(() => {
            if (mountedRef.current) setWorkerReady(true);
        });
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fileMemo = useMemo(() => ({ url, httpHeaders: {} }), [url]);
    const devicePixelRatio = useMemo(() => {
        if (typeof window === 'undefined') {
            return 1;
        }

        return Math.min(window.devicePixelRatio || 1, 1.5);
    }, []);

    const viewportWatermarks = useMemo(() => (
        Array.from({ length: 14 }, (_, index) => ({
            id: index,
            top: `${((index * 17) % 110) - 5}%`,
            left: `${((index * 23) % 110) - 5}%`,
        }))
    ), []);

    const pageNumbers = useMemo(() => (
        numPages ? Array.from({ length: numPages }, (_, index) => index + 1) : []
    ), [numPages]);

    const globalWatermarkText = useMemo(() => (
        `[ ${userName || 'Ẩn danh'} • ${userEmail || 'Bảo mật'} • DO NOT SHARE ]`
    ), [userEmail, userName]);

    const pageWatermarkText = useMemo(() => (
        (userName || 'Bảo mật hệ thống').toUpperCase()
    ), [userName]);

    useEffect(() => {
        const handleContextMenu = (event) => event.preventDefault();
        const container = containerRef.current;

        if (container) {
            container.addEventListener('contextmenu', handleContextMenu);
        }

        return () => {
            if (container) {
                container.removeEventListener('contextmenu', handleContextMenu);
            }
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && ['p', 'c', 's'].includes(event.key.toLowerCase())) {
                event.preventDefault();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        let timeoutId;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const nextWidth = Math.max(300, entry.contentRect.width - 32);
                window.clearTimeout(timeoutId);
                timeoutId = window.setTimeout(() => {
                    setWidth((prevWidth) => (Math.abs(prevWidth - nextWidth) > 6 ? nextWidth : prevWidth));
                }, 120);
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
            window.clearTimeout(timeoutId);
        };
    }, []);

    const onDocumentLoadSuccess = ({ numPages: nextNumPages }) => {
        if (mountedRef.current) {
            setNumPages(nextNumPages);
        }
    };

    const onDocumentLoadError = (error) => {
        if (!mountedRef.current) {
            return;
        }

        console.error('[SecurePdfViewer] PDF load error:', error?.message, error);
    };

    return (
        <div ref={containerRef} className="relative flex h-full w-full select-none flex-col items-center overflow-x-hidden overflow-y-auto bg-slate-900">
            <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden opacity-[0.025]">
                {viewportWatermarks.map((item) => (
                    <div
                        key={item.id}
                        className="absolute whitespace-nowrap text-base font-black tracking-[0.3em] text-white transform -rotate-[35deg]"
                        style={{ top: item.top, left: item.left }}
                    >
                        {globalWatermarkText}
                    </div>
                ))}
            </div>

            <div className="z-10 flex w-full flex-col items-center py-6">
                {!url ? (
                    <div className="flex flex-col items-center p-20 text-slate-400">
                        <span className="material-symbols-outlined mb-4 text-4xl">description</span>
                        <p className="font-medium">Không có tệp đính kèm cho đề thi này.</p>
                    </div>
                ) : !workerReady ? (
                    // TASK 4: Chờ worker init — thường < 50ms
                    <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                        <span className="material-symbols-outlined mb-4 text-4xl animate-spin text-[#fe5f36]">sync</span>
                        <p className="font-medium animate-pulse">Đang khởi động trình đọc PDF...</p>
                    </div>
                ) : (
                    <PdfErrorBoundary>
                        <Document
                            file={fileMemo}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            options={pdfOptions}
                            className="flex w-full flex-col items-center gap-6"
                            loading={
                                <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                                    <span className="material-symbols-outlined mb-4 text-4xl animate-spin text-[#fe5f36]">sync</span>
                                    <p className="font-medium animate-pulse">Đang tải và giải mã đề thi...</p>
                                </div>
                            }
                            error={
                                <div className="mt-10 flex max-w-sm flex-col items-center rounded-2xl border border-red-500/20 bg-red-900/20 p-8 text-center text-red-400 shadow-2xl">
                                    <span className="material-symbols-outlined mb-2 text-4xl">error</span>
                                    <p className="font-bold">Không thể tải đề thi</p>
                                    <p className="mt-1 text-sm opacity-80">File bị lỗi, đã bị xóa hoặc đường dẫn đã hết hạn.</p>
                                </div>
                            }
                        >
                            {pageNumbers.map((pageNumber) => (
                                <PdfPageItem
                                    key={`page_${pageNumber}`}
                                    pageNumber={pageNumber}
                                    width={width}
                                    devicePixelRatio={devicePixelRatio}
                                    watermarkText={pageWatermarkText}
                                />
                            ))}
                        </Document>
                    </PdfErrorBoundary>
                )}
            </div>
        </div>
    );
}
