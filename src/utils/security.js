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

// Session management functions
export const createSession = (userData) => {
  try {
    const sessionData = {
      user: userData,
      created: Date.now(),
      expires: Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT
    };
    const encryptedSession = CryptoJS.AES.encrypt(
      JSON.stringify(sessionData),
      SECURITY_CONFIG.ENCRYPTION_KEY
    ).toString();
    localStorage.setItem('secure_session', encryptedSession);
    return true;
  } catch (error) {
    console.error('Error creating session:', error);
    return false;
  }
};

export const validateSession = () => {
  try {
    const encryptedSession = localStorage.getItem('secure_session');
    if (!encryptedSession) return null;
    
    const decrypted = CryptoJS.AES.decrypt(
      encryptedSession,
      SECURITY_CONFIG.ENCRYPTION_KEY
    ).toString(CryptoJS.enc.Utf8);
    
    const session = JSON.parse(decrypted);
    
    // Check if session has expired
    if (session.expires < Date.now()) {
      clearSession();
      return null;
    }
    
    // Extend session
    createSession(session.user);
    return session;
  } catch (error) {
    console.error('Error validating session:', error);
    clearSession();
    return null;
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem('secure_session');
    return true;
  } catch (error) {
    console.error('Error clearing session:', error);
    return false;
  }
};

// Password validation
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password) {
    return {
      isValid: false,
      errors: ['Password is required'],
      strength: { score: 0, strength: 'Very Weak', color: 'red' }
    };
  }
  
  if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`);
  }
  
  if (password.length > SECURITY_CONFIG.PASSWORD_MAX_LENGTH) {
    errors.push(`Password cannot exceed ${SECURITY_CONFIG.PASSWORD_MAX_LENGTH} characters`);
  }
  
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  
  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!hasNumber) {
    errors.push('Password must contain at least one number');
  }
  
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }
  
  // Calculate password strength
  let strengthScore = 0;
  if (password.length >= 8) strengthScore += 1;
  if (password.length >= 12) strengthScore += 1;
  if (hasUppercase) strengthScore += 2;
  if (hasLowercase) strengthScore += 2;
  if (hasNumber) strengthScore += 2;
  if (hasSpecialChar) strengthScore += 2;
  
  let strengthText = 'Very Weak';
  let strengthColor = 'red';
  
  if (strengthScore >= 8) {
    strengthText = 'Strong';
    strengthColor = 'green';
  } else if (strengthScore >= 6) {
    strengthText = 'Good';
    strengthColor = 'blue';
  } else if (strengthScore >= 4) {
    strengthText = 'Medium';
    strengthColor = 'yellow';
  } else if (strengthScore >= 2) {
    strengthText = 'Weak';
    strengthColor = 'orange';
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength: {
      score: strengthScore,
      strength: strengthText,
      color: strengthColor
    }
  };
};

// Email validation
export const validateEmail = (email) => {
  if (!email) return false;
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Additional checks for length
  return emailRegex.test(email) && 
         email.length <= 254 && // Max email length
         email.indexOf('@') <= 64; // Max local part length
};

// Business name validation
export const validateBusinessName = (name) => {
  if (!name || name.trim() === '') {
    return { isValid: false, error: 'Business name is required' };
  }
  
  if (name.length > 100) {
    return { isValid: false, error: 'Business name cannot exceed 100 characters' };
  }
  
  return { isValid: true };
};

// Input sanitization
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  
  // Remove potential XSS patterns
  let sanitized = input;
  SECURITY_CONFIG.XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Encode HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
    
  return sanitized;
};

// Inventory item validation
export const validateInventoryItem = (item) => {
  const errors = [];
  
  if (!item.name || item.name.trim() === '') {
    errors.push('Item name is required');
  }
  
  if (item.name && item.name.length > 100) {
    errors.push('Item name cannot exceed 100 characters');
  }
  
  if (item.quantity === undefined || item.quantity === null || isNaN(item.quantity)) {
    errors.push('Valid quantity is required');
  }
  
  if (item.unitPrice === undefined || item.unitPrice === null || isNaN(item.unitPrice)) {
    errors.push('Valid unit price is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// File validation
export const validateFile = (file) => {
  const errors = [];
  
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }
  
  if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
    errors.push(`File exceeds maximum size of ${SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }
  
  if (!SECURITY_CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
    errors.push('Invalid file type. Only Excel and CSV files are allowed.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Rate limiting for login attempts
const failedLoginAttempts = {};

export const recordFailedAttempt = (email) => {
  const normalizedEmail = email.toLowerCase();
  
  if (!failedLoginAttempts[normalizedEmail]) {
    failedLoginAttempts[normalizedEmail] = {
      count: 0,
      firstAttempt: Date.now(),
      lockUntil: null
    };
  }
  
  failedLoginAttempts[normalizedEmail].count += 1;
  
  // Check if we should lock the account
  if (failedLoginAttempts[normalizedEmail].count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
    failedLoginAttempts[normalizedEmail].lockUntil = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION;
  }
};

export const checkRateLimit = (email) => {
  const normalizedEmail = email.toLowerCase();
  const attempts = failedLoginAttempts[normalizedEmail];
  
  if (!attempts) {
    return { allowed: true };
  }
  
  // Check if lockout period has expired
  if (attempts.lockUntil && attempts.lockUntil > Date.now()) {
    const remainingMinutes = Math.ceil((attempts.lockUntil - Date.now()) / (60 * 1000));
    return { 
      allowed: false, 
      remainingTime: remainingMinutes
    };
  }
  
  // If we're here, either there was no lockout or it has expired
  if (attempts.lockUntil && attempts.lockUntil <= Date.now()) {
    // Reset after lockout period
    clearFailedAttempts(normalizedEmail);
  }
  
  return { allowed: true };
};

export const clearFailedAttempts = (email) => {
  const normalizedEmail = email.toLowerCase();
  delete failedLoginAttempts[normalizedEmail];
};

// Password hashing
export const hashPassword = (password) => {
  // Generate a random salt
  const salt = CryptoJS.lib.WordArray.random(16).toString();
  
  // Hash the password with the salt
  const hash = CryptoJS.PBKDF2(password, salt, {
    keySize: 512/32,
    iterations: 1000
  }).toString();
  
  return { hash, salt };
};

// Password verification
export const verifyPassword = (password, storedHash, storedSalt) => {
  // Hash the input password with the stored salt
  const hash = CryptoJS.PBKDF2(password, storedSalt, {
    keySize: 512/32,
    iterations: 1000
  }).toString();
  
  // Compare the hashes
  return hash === storedHash;
};

// Security event logging
export const logSecurityEvent = (event, details = {}) => {
  try {
    // Add timestamp and browser info
    const logEntry = {
      event,
      timestamp: new Date().toISOString(),
      details: {
        ...details,
        userAgent: navigator.userAgent,
        ip: '127.0.0.1' // In a real app, this would be the actual IP
      }
    };
    
    // Get existing logs
    const existingLogs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    
    // Add new log entry (limit to 1000 entries)
    const updatedLogs = [logEntry, ...existingLogs].slice(0, 1000);
    
    // Save back to localStorage
    localStorage.setItem('security_logs', JSON.stringify(updatedLogs));
    
    // In a production environment, you might also want to send this to a server
    console.log(`Security Event: ${event}`, details);
  } catch (error) {
    console.error('Error logging security event:', error);
  }
};

// Generate a secure reset token
export const generateResetToken = (email) => {
  const timestamp = Date.now();
  const randomString = CryptoJS.lib.WordArray.random(32).toString();
  const data = `${email}:${timestamp}:${randomString}`;
  
  // Create a secure token using HMAC
  const token = CryptoJS.HmacSHA256(
    data, 
    SECURITY_CONFIG.ENCRYPTION_KEY
  ).toString();
  
  return token;
};

// Verify token
export const verifyToken = (token, email, tokenType) => {
  // In a real implementation, this would verify against a database
  // For this demo, we're just returning true
  return true;
};

export default SECURITY_CONFIG;