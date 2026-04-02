import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
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
