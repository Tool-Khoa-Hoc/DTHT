import React, { Suspense, lazy } from 'react';

const SecurePdfViewer = lazy(async () => {
    const [, , module] = await Promise.all([
        import('react-pdf/dist/esm/Page/AnnotationLayer.css'),
        import('react-pdf/dist/esm/Page/TextLayer.css'),
        import('./SecurePdfViewer'),
    ]);

    return module;
});

function PdfViewerFallback() {
    return (
        <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-300">
            <div className="flex flex-col items-center gap-3">
                <span className="material-symbols-outlined animate-spin text-4xl text-[#fe5f36]">sync</span>
                <p className="text-sm font-semibold">Đang tải trình xem đề...</p>
            </div>
        </div>
    );
}

export default function DocumentRenderer({ url, userEmail, userName }) {
    if (!url) {
        return null;
    }

    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com')) {
        let previewUrl = url;

        if (lowerUrl.includes('/view') || lowerUrl.includes('/edit')) {
            previewUrl = url.replace(/\/(view|edit)(\?.*)?$/, '/preview$2');
            previewUrl = previewUrl.replace(/\/(view|edit)$/, '/preview');
        } else if (!lowerUrl.includes('/preview')) {
            const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (fileMatch) {
                const baseHost = lowerUrl.includes('docs.google.com')
                    ? 'https://docs.google.com/document'
                    : 'https://drive.google.com/file';
                previewUrl = `${baseHost}/d/${fileMatch[1]}/preview`;
            }
        }

        return (
            <iframe
                src={previewUrl}
                className="h-full min-h-[85vh] w-full bg-white"
                style={{ border: 'none' }}
                title="Google Docs/Drive Viewer"
            />
        );
    }

    if (lowerUrl.match(/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/)) {
        return (
            <div className="flex h-full w-full justify-center overflow-auto bg-slate-900 p-8">
                <img
                    src={url}
                    alt="Bản xem trước dữ liệu"
                    className="h-auto max-w-full rounded-xl object-contain shadow-2xl"
                    loading="lazy"
                    decoding="async"
                />
            </div>
        );
    }

    if (lowerUrl.match(/\.(doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/)) {
        const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
        return (
            <iframe
                src={officeUrl}
                className="h-full min-h-[85vh] w-full bg-white"
                style={{ border: 'none' }}
                title="Office Document Viewer"
            />
        );
    }

    return (
        <Suspense fallback={<PdfViewerFallback />}>
            <SecurePdfViewer
                url={url}
                userEmail={userEmail}
                userName={userName}
            />
        </Suspense>
    );
}
