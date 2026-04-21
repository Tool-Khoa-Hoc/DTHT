import React from 'react';

/**
 * Check if an error originates from pdfjs-dist worker lifecycle.
 * These errors fire when navigating away from a page with a PDF viewer,
 * and the PDF worker's messageHandler becomes null during cleanup.
 */
function isPdfjsWorkerError(error) {
    const msg = String(error?.message || '');
    return (
        msg.includes('sendWithPromise') ||
        msg.includes('Cannot read properties of null') && msg.includes('send') ||
        msg.includes('worker was destroyed') ||
        msg.includes('Worker was terminated')
    );
}

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
        this._unhandledRejectionHandler = null;
    }

    static getDerivedStateFromError(error) {
        // Suppress pdfjs worker errors — they are harmless navigation artifacts
        if (isPdfjsWorkerError(error)) {
            console.warn('[ErrorBoundary] Suppressed pdfjs worker error:', error?.message);
            return null; // Don't trigger error state
        }
        return { hasError: true, error };
    }

    componentDidMount() {
        // Catch unhandled promise rejections from pdfjs-dist worker cleanup
        this._unhandledRejectionHandler = (event) => {
            if (isPdfjsWorkerError(event?.reason)) {
                event.preventDefault();
                console.warn('[ErrorBoundary] Suppressed unhandled pdfjs rejection:', event?.reason?.message);
            }
        };
        window.addEventListener('unhandledrejection', this._unhandledRejectionHandler);
    }

    componentWillUnmount() {
        if (this._unhandledRejectionHandler) {
            window.removeEventListener('unhandledrejection', this._unhandledRejectionHandler);
        }
    }

    componentDidCatch(error, errorInfo) {
        if (isPdfjsWorkerError(error)) {
            // Reset the error state since we want to suppress this
            this.setState({ hasError: false, error: null });
            return;
        }
        console.error("UI Error Caught by Boundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen font-display bg-[#0a0c14] text-white flex items-center justify-center p-6">
                    <div className="max-w-md w-full text-center space-y-6">
                        <div className="w-24 h-24 bg-red-500/10 text-red-400 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20 shadow-xl">
                            <span className="material-symbols-outlined text-5xl">warning</span>
                        </div>
                        <h1 className="text-3xl font-black">Ôi hỏng rồi!</h1>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Có vẻ như trang web vừa gặp một sự cố không lường trước được. Mong cậu thông cảm nhé! Nhấn nút tải lại để làm mới giao diện.
                        </p>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left overflow-hidden">
                            <p className="font-mono text-xs text-red-300 break-words opacity-80" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                {this.state.error?.toString() || 'Unknown React render error'}
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-[#3b82f6] text-white py-3 px-8 rounded-xl font-bold hover:bg-[#2563eb] transition-colors shadow-lg shadow-[#3b82f6]/30 flex items-center justify-center gap-2 mx-auto"
                        >
                            <span className="material-symbols-outlined text-[20px]">refresh</span>
                            Thử tải lại trang
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

