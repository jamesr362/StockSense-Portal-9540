// Simplified secure logging utility to prevent app crashes
const isDevelopment = process.env.NODE_ENV === 'development';

// List of sensitive keywords that should be redacted
const SENSITIVE_KEYWORDS = [
  'password',
  'secret',
  'key',
  'token',
  'credential',
  'admin_password',
  'platformadmin_password',
  'stripe_secret',
  'webhook_secret'
];

// Function to sanitize sensitive data
const sanitizeData = (data) => {
  if (typeof data === 'string') {
    // Only redact if it contains actual sensitive patterns
    if (SENSITIVE_KEYWORDS.some(keyword => data.toLowerCase().includes(keyword) && data.length > 20)) {
      return '[REDACTED]';
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      // Only redact keys that are clearly sensitive
      if (SENSITIVE_KEYWORDS.some(keyword => key.toLowerCase() === keyword)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  
  return data;
};

// Simplified secure logging functions that won't break the app
export const secureLog = {
  info: (...args) => {
    try {
      if (isDevelopment) {
        const sanitizedArgs = args.map(arg => {
          try {
            return sanitizeData(arg);
          } catch {
            return '[LOG_ERROR]';
          }
        });
        console.log(...sanitizedArgs);
      }
    } catch {
      // Never crash the app due to logging
    }
  },
  
  warn: (...args) => {
    try {
      if (isDevelopment) {
        const sanitizedArgs = args.map(arg => {
          try {
            return sanitizeData(arg);
          } catch {
            return '[LOG_ERROR]';
          }
        });
        console.warn(...sanitizedArgs);
      }
    } catch {
      // Never crash the app due to logging
    }
  },
  
  error: (...args) => {
    try {
      // Always log errors but sanitize them
      const sanitizedArgs = args.map(arg => {
        try {
          return sanitizeData(arg);
        } catch {
          return '[LOG_ERROR]';
        }
      });
      console.error(...sanitizedArgs);
    } catch {
      // Last resort: use basic console.error
      console.error('Logging error occurred');
    }
  },
  
  debug: (...args) => {
    try {
      if (isDevelopment) {
        const sanitizedArgs = args.map(arg => {
          try {
            return sanitizeData(arg);
          } catch {
            return '[LOG_ERROR]';
          }
        });
        console.debug('[DEBUG]', ...sanitizedArgs);
      }
    } catch {
      // Never crash the app due to logging
    }
  }
};

// Function to disable console methods in production (optional)
export const disableConsoleInProduction = () => {
  if (process.env.NODE_ENV === 'production') {
    const noop = () => {};
    console.log = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    // Keep console.error for critical issues
  }
};

export default secureLog;