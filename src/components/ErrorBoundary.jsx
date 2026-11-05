import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-background text-foreground p-6 flex flex-col items-center justify-center font-sans">
          <div className="max-w-2xl w-full imperial-frame p-6 sm:p-8">
            <div className="flex items-center gap-3 text-primary mb-4">
              <span className="material-symbols-outlined text-4xl" aria-hidden="true">
                error
              </span>
              <h1 className="text-2xl font-display font-bold text-foreground">
                Đã xảy ra lỗi hiển thị giao diện
              </h1>
            </div>
            <p className="text-secondary-text mb-4 text-sm leading-relaxed">
              Vui lòng tải lại trang hoặc báo lại thông tin bên dưới cho ban quản trị:
            </p>
            <div className="bg-surface-alt p-4 rounded-xl overflow-auto max-h-96 border border-border mb-6">
              <p className="text-primary font-mono text-sm font-bold mb-2">
                {this.state.error && this.state.error.toString()}
              </p>
              <pre className="text-secondary-text font-mono text-xs whitespace-pre-wrap">
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/home';
              }}
              className="btn-arena btn-arena-primary"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                refresh
              </span>
              Tải lại trang chủ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
