/**
 * Monaco Editor Configuration
 * Configures Monaco Editor to use unpkg.com CDN instead of jsdelivr.net
 * This prevents ERR_QUIC_PROTOCOL_ERROR and other CDN loading issues
 */

if (typeof window !== 'undefined') {
  // Configure Monaco Environment before any Monaco components load
  (window as any).MonacoEnvironment = {
    getWorkerUrl: function (moduleId: string, label: string) {
      // Use unpkg.com CDN - more reliable than jsdelivr
      const baseUrl = 'https://unpkg.com/monaco-editor@0.55.1/esm/vs';
      
      switch (label) {
        case 'json':
          return `${baseUrl}/language/json/json.worker.js`;
        case 'css':
        case 'scss':
        case 'less':
          return `${baseUrl}/language/css/css.worker.js`;
        case 'html':
        case 'handlebars':
        case 'razor':
          return `${baseUrl}/language/html/html.worker.js`;
        case 'typescript':
        case 'javascript':
          return `${baseUrl}/language/typescript/ts.worker.js`;
        default:
          return `${baseUrl}/editor/editor.worker.js`;
      }
    }
  };

  // Override require.config to use unpkg.com for Monaco loader
  const configureMonacoLoader = () => {
    if ((window as any).require && typeof (window as any).require.config === 'function') {
      try {
        (window as any).require.config({
          paths: {
            vs: 'https://unpkg.com/monaco-editor@0.55.1/min/vs'
          }
        });
        console.log('[Monaco Config] ✅ Configured Monaco loader to use unpkg.com');
      } catch (e) {
        // Config might already be set, ignore
      }
    }
  };

  // Try to configure immediately
  configureMonacoLoader();

  // Also configure when require becomes available (Monaco loads asynchronously)
  let checkCount = 0;
  const maxChecks = 100; // Check for up to 10 seconds
  
  const checkInterval = setInterval(() => {
    checkCount++;
    if ((window as any).require) {
      configureMonacoLoader();
      clearInterval(checkInterval);
    } else if (checkCount >= maxChecks) {
      clearInterval(checkInterval);
      console.warn('[Monaco Config] ⚠️ Monaco require not found after 10 seconds');
    }
  }, 100);

  // Cleanup function (though interval will clear itself)
  (window as any).__monacoConfigCleanup = () => {
    clearInterval(checkInterval);
  };
}
