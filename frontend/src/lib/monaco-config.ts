/**
 * Monaco Editor Configuration
 * Configures Monaco Editor to use CDN properly with Next.js
 */

if (typeof window !== 'undefined') {
  // Configure Monaco Environment before any Monaco components load
  (window as any).MonacoEnvironment = {
    getWorkerUrl: function (moduleId: string, label: string) {
      // Use jsdelivr CDN - better CORS support than unpkg for workers
      const baseUrl = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/esm/vs';
      
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

  console.log('[Monaco Config] ✅ Monaco environment configured');
}
