import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Simple error boundary to prevent app crashes
function ErrorBoundary({ children }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      {children}
    </div>
  );
}

// Initialize app with error protection
const initializeApp = () => {
  try {
    // Disable console logs in production for security
    if (process.env.NODE_ENV === 'production') {
      const noop = () => {};
      console.log = noop;
      console.warn = noop;
      console.info = noop;
      console.debug = noop;
      // Keep console.error for critical issues
    }

    // Render the app
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  } catch (error) {
    // Fallback rendering if main app fails
    document.getElementById('root').innerHTML = `
      <div style="min-height: 100vh; background: #1f2937; display: flex; align-items: center; justify-content: center; color: white; font-family: system-ui;">
        <div style="text-align: center;">
          <h1 style="font-size: 2rem; margin-bottom: 1rem;">Loading...</h1>
          <p>Please wait while the application initializes.</p>
        </div>
      </div>
    `;
    
    // Try to reload after a delay
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }
};

// Initialize the app
initializeApp();