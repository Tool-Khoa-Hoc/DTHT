import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Fix for Vite: set the workerSrc explicitly to use it from the node_modules via URL
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

export default function SecurePdfViewer({ url, userEmail, userName }) {
    const [numPages, setNumPages] = useState(null);
    const containerRef = useRef(null);
    const [width, setWidth] = useState(800);

    // Prevent contextual menu (Right click) globally on this container
    useEffect(() => {
        const handleContextMenu = (e) => e.preventDefault();
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

    // Prevent copying and printing via keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'c' || e.key === 's')) {
                e.preventDefault();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Dynamically adjust width for responsive scaling of the PDF
    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                // subtract padding/margin to fit nicely
                const newWidth = Math.max(300, entry.contentRect.width - 32);
                setWidth(newWidth); 
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
    }

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-900 overflow-y-auto overflow-x-hidden flex flex-col items-center select-none">
            {/* Global Watermark Overlay Pattern for viewport */}
            <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden opacity-[0.025]">
                {Array.from({ length: 14 }).map((_, i) => (
                    <div 
                        key={i} 
                        className="absolute whitespace-nowrap transform -rotate-[35deg] font-black text-white text-base tracking-[0.3em]"
                        style={{
                            top: `${Math.random() * 120 - 10}%`,
                            left: `${Math.random() * 120 - 10}%`,
                        }}
                    >
                        [ {userName || 'Ẩn danh'} • {userEmail || 'Bảo mật'} • DO NOT SHARE ]
                    </div>
                ))}
            </div>

            <div className="py-6 z-10 w-full flex flex-col items-center">
                {!url && (
                    <div className="flex flex-col items-center p-20 text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-4">description</span>
                        <p className="font-medium">Không có tệp đính kèm cho đề thi này.</p>
                    </div>
                )}
                
                {url && (
                    <Document
                        file={url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        className="flex flex-col gap-6 items-center w-full"
                        loading={
                            <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                                <span className="material-symbols-outlined animate-spin text-4xl mb-4 text-[#fe5f36]">sync</span>
                                <p className="font-medium animate-pulse">Đang tải và giải mã đề thi...</p>
                            </div>
                        }
                        error={
                            <div className="p-8 text-red-400 bg-red-900/20 border border-red-500/20 rounded-2xl flex flex-col items-center text-center max-w-sm mt-10 shadow-2xl">
                                <span className="material-symbols-outlined text-4xl mb-2">error</span>
                                <p className="font-bold">Không thể tải đề thi</p>
                                <p className="text-sm opacity-80 mt-1">File bị lỗi, đã bị xóa hoặc đường dẫn đã hết hạn.</p>
                            </div>
                        }
                    >
                        {Array.from(new Array(numPages), (el, index) => (
                            <div key={`page_${index + 1}`} className="shadow-2xl shadow-black/80 ring-1 ring-white/10 rounded-lg overflow-hidden group relative bg-white">
                                 {/* Individual page watermark */}
                                 <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center opacity-[0.1] overflow-hidden px-6">
                                     <h1 className="text-black leading-none font-black transform -rotate-45 whitespace-nowrap opacity-50 mix-blend-multiply" style={{ fontSize: 'clamp(34px, 5.8vw, 68px)' }}>
                                         {userName?.toUpperCase() || 'BẢO MẬT HỆ THỐNG'}
                                     </h1>
                                 </div>
                                 
                                <Page 
                                    pageNumber={index + 1} 
                                    width={width}
                                    renderTextLayer={false} 
                                    renderAnnotationLayer={false}
                                    className="bg-white"
                                    loading={
                                        <div className="w-full h-[800px] flex items-center justify-center bg-slate-100">
                                            <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">autorenew</span>
                                        </div>
                                    }
                                />
                            </div>
                        ))}
                    </Document>
                )}
            </div>
        </div>
    );
}
