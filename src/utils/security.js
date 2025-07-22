import CryptoJS from 'crypto-js';

// Security configuration 
const SECURITY_CONFIG = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes 
  SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hour 
  ENCRYPTION_KEY: 'trackio-secure-key-2024', // In production, use environment variable 
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB 
  ALLOWED_FILE_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ],
  XSS_PATTERNS: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi
  ]
};

// Input sanitization and validation
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  // Remove potential XSS patterns
  let sanitized = input;
  SECURITY_CONFIG.XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // HTML encode special characters
  return sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// SQL injection prevention
export const sanitizeSQLInput = (input) => {
  if (typeof input !== 'string') return input;

  const sqlPatterns = [
    /('|(\\')|(;)|(--)|(\s+(or|and)\s+))/gi,
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
    /(\*|%|_)/gi
  ];

  let sanitized = input;
  sqlPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized.trim();
};

// Email validation with security checks
export const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false; // RFC 5321 limit
  if (!emailRegex.test(email)) return false;

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\./, // consecutive dots
    /^\./, // starts with dot
    /\.$/, // ends with dot
    /@.*@/, // multiple @ symbols
  ];

  return !suspiciousPatterns.some(pattern => pattern.test(email));
};

// Password strength validation
export const validatePassword = (password) => {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`);
  }

  if (password.length > SECURITY_CONFIG.PASSWORD_MAX_LENGTH) {
    errors.push(`Password must not exceed ${SECURITY_CONFIG.PASSWORD_MAX_LENGTH} characters`);
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common weak passwords
  const weakPasswords = [
    'password', '123456', 'qwerty', 'admin', 'letmein',
    'welcome', 'password123', 'admin123', '123456789', 'qwerty123'
  ];

  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common and easily guessable');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password)
  };
};

// Calculate password strength score
const calculatePasswordStrength = (password) => {
  let score = 0;
  let feedback = [];

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  // Complexity patterns
  if (/[a-z].*[A-Z]|[A-Z].*[a-z]/.test(password)) score += 1;
  if (/[a-zA-Z].*[0-9]|[0-9].*[a-zA-Z]/.test(password)) score += 1;

  let strength = 'Very Weak';
  let color = 'red';

  if (score >= 7) {
    strength = 'Very Strong';
    color = 'green';
  } else if (score >= 5) {
    strength = 'Strong';
    color = 'blue';
  } else if (score >= 3) {
    strength = 'Medium';
    color = 'yellow';
  } else if (score >= 1) {
    strength = 'Weak';
    color = 'orange';
  }

  return { score, strength, color };
};

// Secure password hashing (client-side pre-processing)
export const hashPassword = (password, salt = null) => {
  const saltToUse = salt || CryptoJS.lib.WordArray.random(128/8).toString();
  const hash = CryptoJS.PBKDF2(
    password,
    saltToUse,
    { keySize: 256/32, iterations: 10000 }
  ).toString();

  return { hash: hash, salt: saltToUse };
};

// Verify password hash
export const verifyPassword = (password, storedHash, salt) => {
  const computed = hashPassword(password, salt);
  return computed.hash === storedHash;
};

// Rate limiting for login attempts
export const checkRateLimit = (email) => {
  const key = `login_attempts_${email}`;
  const attempts = JSON.parse(localStorage.getItem(key) || '{"count": 0, "lastAttempt": 0}');
  const now = Date.now();

  // Reset counter if lockout period has passed
  if (now - attempts.lastAttempt > SECURITY_CONFIG.LOCKOUT_DURATION) {
    attempts.count = 0;
  }

  if (attempts.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
    const remainingTime = SECURITY_CONFIG.LOCKOUT_DURATION - (now - attempts.lastAttempt);
    if (remainingTime > 0) {
      return {
        allowed: false,
        remainingTime: Math.ceil(remainingTime / 60000) // minutes
      };
    }
  }

  return { allowed: true };
};

// Record failed login attempt
export const recordFailedAttempt = (email) => {
  const key = `login_attempts_${email}`;
  const attempts = JSON.parse(localStorage.getItem(key) || '{"count": 0, "lastAttempt": 0}');
  attempts.count += 1;
  attempts.lastAttempt = Date.now();
  localStorage.setItem(key, JSON.stringify(attempts));
};

// Clear failed attempts on successful login
export const clearFailedAttempts = (email) => {
  const key = `login_attempts_${email}`;
  localStorage.removeItem(key);
};

// File validation for uploads
export const validateFile = (file) => {
  const errors = [];
  
  if (!file) {
    errors.push('No file selected');
    return { isValid: false, errors };
  }

  // File size check
  if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
    errors.push(`File size must not exceed ${SECURITY_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // File type check
  if (!SECURITY_CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
    errors.push('Invalid file type. Only Excel and CSV files are allowed');
  }

  // File name validation
  const fileName = file.name;
  if (fileName.length > 255) {
    errors.push('File name is too long');
  }

  // Check for suspicious file names
  const suspiciousPatterns = [
    /\.(exe|bat|cmd|scr|pif|com)$/i,
    /[<>:"|?*]/,
    /\.\./,
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(fileName))) {
    errors.push('File name contains invalid characters');
  }

  return { isValid: errors.length === 0, errors };
};

// Session management
export const createSession = (userData) => {
  const sessionData = {
    user: userData,
    createdAt: Date.now(),
    expiresAt: Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT,
    sessionId: CryptoJS.lib.WordArray.random(32).toString()
  };

  // Encrypt session data
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(sessionData),
    SECURITY_CONFIG.ENCRYPTION_KEY
  ).toString();

  localStorage.setItem('session', encrypted);
  return sessionData.sessionId;
};

// Validate session
export const validateSession = () => {
  try {
    const encrypted = localStorage.getItem('session');
    if (!encrypted) return null;

    const decrypted = CryptoJS.AES.decrypt(encrypted, SECURITY_CONFIG.ENCRYPTION_KEY);
    const sessionData = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));

    if (Date.now() > sessionData.expiresAt) {
      clearSession();
      return null;
    }

    // Extend session if it's more than half expired
    const halfTime = (sessionData.expiresAt - sessionData.createdAt) / 2;
    if (Date.now() - sessionData.createdAt > halfTime) {
      sessionData.expiresAt = Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT;
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(sessionData),
        SECURITY_CONFIG.ENCRYPTION_KEY
      ).toString();
      localStorage.setItem('session', encrypted);
    }

    return sessionData;
  } catch (error) {
    console.error('Session validation error:', error);
    clearSession();
    return null;
  }
};

// Clear session
export const clearSession = () => {
  localStorage.removeItem('session');
  localStorage.removeItem('userEmail'); // Legacy cleanup
};

// Content Security Policy helpers
export const generateNonce = () => {
  return CryptoJS.lib.WordArray.random(16).toString();
};

// Audit logging
export const logSecurityEvent = (event, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details: {
      ...details,
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: validateSession()?.sessionId
    }
  };

  // Store in localStorage (in production, send to server)
  const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
  logs.push(logEntry);

  // Keep only last 100 logs
  if (logs.length > 100) {
    logs.splice(0, logs.length - 100);
  }

  localStorage.setItem('security_logs', JSON.stringify(logs));
  console.log('Security Event:', logEntry);
};

// Input length validation
export const validateInputLength = (input, maxLength = 1000) => {
  if (typeof input !== 'string') return true;
  return input.length <= maxLength;
};

// Business name validation
export const validateBusinessName = (name) => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Business name is required' };
  }

  if (name.length < 2) {
    return { isValid: false, error: 'Business name must be at least 2 characters long' };
  }

  if (name.length > 100) {
    return { isValid: false, error: 'Business name must not exceed 100 characters' };
  }

  // Allow only letters, numbers, spaces, and common business punctuation
  const validPattern = /^[a-zA-Z0-9\s\-&'.,()]+$/;
  if (!validPattern.test(name)) {
    return { isValid: false, error: 'Business name contains invalid characters' };
  }

  return { isValid: true };
};

// Inventory item validation
export const validateInventoryItem = (item) => {
  const errors = [];

  // Name validation
  if (!item.name || typeof item.name !== 'string') {
    errors.push('Item name is required');
  } else if (item.name.length < 1 || item.name.length > 100) {
    errors.push('Item name must be between 1 and 100 characters');
  }

  // Quantity validation
  if (typeof item.quantity !== 'number' || item.quantity < 0 || item.quantity > 1000000) {
    errors.push('Quantity must be a number between 0 and 1,000,000');
  }

  // Price validation
  if (typeof item.unitPrice !== 'number' || item.unitPrice < 0 || item.unitPrice > 1000000) {
    errors.push('Unit price must be a number between 0 and 1,000,000');
  }

  // Category validation
  if (item.category && (typeof item.category !== 'string' || item.category.length > 50)) {
    errors.push('Category must be a string with maximum 50 characters');
  }

  // Description validation
  if (item.description && (typeof item.description !== 'string' || item.description.length > 500)) {
    errors.push('Description must be a string with maximum 500 characters');
  }

  return { isValid: errors.length === 0, errors };
};

export default {
  sanitizeInput,
  sanitizeSQLInput,
  validateEmail,
  validatePassword,
  hashPassword,
  verifyPassword,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  validateFile,
  createSession,
  validateSession,
  clearSession,
  logSecurityEvent,
  validateInputLength,
  validateBusinessName,
  validateInventoryItem,
  SECURITY_CONFIG
};