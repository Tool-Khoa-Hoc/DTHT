import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SecurityWrapper provides basic protection against common inspection techniques.
 * It is most active on /exam routes but can be configured globally.
 */
export default function SecurityWrapper({ children }) {
  const location = useLocation();
  const isExamRoute = location.pathname.startsWith('/exam');

  useEffect(() => {
    // Only enable strict security on exam-related routes to avoid annoying admins/devs elsewhere
    // However, the user asked for "web của tớ" (my web), so we can enable it globally 
    // but maybe keep it lighter on non-exam routes.
    
    const handleContextMenu = (e) => {
      if (isExamRoute) {
        e.preventDefault();
        return false;
      }
    };

    const handleKeyDown = (e) => {
      // Block common shortcuts
      const forbiddenKeys = [
          'F12',
          'u', // Ctrl + U (View Source)
          'i', // Ctrl + Shift + I (Inspect)
          'c', // Ctrl + Shift + C (Element selector)
          'j', // Ctrl + Shift + J (Console)
          's', // Ctrl + S (Save)
      ];

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      if (e.key === 'F12' || (isCtrl && forbiddenKeys.includes(e.key.toLowerCase()))) {
        if (isExamRoute || isCtrl) { // More aggressive on Ctrl shortcuts
            e.preventDefault();
            console.warn("Security Error: Access Denied.");
            return false;
        }
      }
    };

    // Advanced DevTools Detection Loop (Using debugger statement)
    // This is "aggressive" and will pause execution if DevTools is open.
    let devToolsInterval;
    if (isExamRoute) {
        devToolsInterval = setInterval(() => {
            const startTime = performance.now();
            debugger;
            const endTime = performance.now();
            
            // If the time between startTime and endTime is large, it means the 
            // debugger statement was hit and the user is likely in DevTools.
            if (endTime - startTime > 100) {
               // Optional: Redirect or show warning
               // window.location.href = '/restricted';
            }
        }, 1000);
    }

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      if (devToolsInterval) clearInterval(devToolsInterval);
    };
  }, [isExamRoute]);

  return <>{children}</>;
}
