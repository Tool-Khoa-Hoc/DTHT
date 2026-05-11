import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SecurityWrapper provides lightweight exam-route protections without
 * interfering with normal browser and form shortcuts elsewhere in the app.
 */
export default function SecurityWrapper({ children }) {
  const location = useLocation();
  const isExamRoute = location.pathname.startsWith('/exam');

  useEffect(() => {
    const handleContextMenu = (event) => {
      if (isExamRoute) {
        event.preventDefault();
      }
    };

    const handleKeyDown = (event) => {
      if (!isExamRoute) {
        return;
      }

      const isCtrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const blocked =
        event.key === 'F12' ||
        (isCtrl && (key === 'u' || key === 's')) ||
        (isCtrl && event.shiftKey && (key === 'i' || key === 'j' || key === 'c'));

      if (blocked) {
        event.preventDefault();
        console.warn('Security Error: Access Denied.');
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExamRoute]);

  return <>{children}</>;
}
