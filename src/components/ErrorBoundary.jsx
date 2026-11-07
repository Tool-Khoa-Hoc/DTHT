import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getStoredLanguage, translate } from '../i18n';
import LanguageToggle from './ui/LanguageToggle';
import ThemeToggle from './ui/ThemeToggle';

function ErrorFallbackCard({ error, errorInfo }) {
  const ctx = useLanguage();
  const t = ctx?.t || ((key) => translate(getStoredLanguage(), key));

  return (
    <div className="min-h-dvh bg-background text-foreground p-6 flex flex-col items-center justify-center font-sans">
      <div className="max-w-2xl w-full imperial-frame p-6 sm:p-8 relative">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 text-primary min-w-0">
            <span className="material-symbols-outlined text-3xl sm:text-4xl shrink-0" aria-hidden="true">
              error
            </span>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground leading-snug">
              {t('errorBoundary.title')}
            </h1>
          </div>
          <div className="relative z-30 flex items-center gap-1.5 shrink-0">
            <LanguageToggle variant="compact" />
            <ThemeToggle variant="compact" />
          </div>
        </div>
        <p className="text-secondary-text mb-4 text-sm leading-relaxed">
          {t('errorBoundary.desc')}
        </p>
        <div className="bg-surface-alt p-4 rounded-xl overflow-auto max-h-96 border border-border mb-6">
          <p className="text-primary font-mono text-sm font-bold mb-2">
            {error && error.toString()}
          </p>
          <pre className="text-secondary-text font-mono text-xs whitespace-pre-wrap">
            {errorInfo && errorInfo.componentStack}
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
          {t('errorBoundary.reloadHome')}
        </button>
      </div>
    </div>
  );
}

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
      return <ErrorFallbackCard error={this.state.error} errorInfo={this.state.errorInfo} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
