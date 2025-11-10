import { secureLog } from './secureLogging';

const FAILED_ATTEMPTS = 'failed_login_attempts';
const RATE_LIMIT_DURATION = 15; // minutes
const MAX_ATTEMPTS = 5;
const SESSION_KEY = 'user_session';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

export const validateBusinessName = (businessName) => {
  if (!businessName || typeof businessName !== 'string') {
    return {
      isValid: false,
      error: 'Business name is required'
    };
  }

  const trimmed = businessName.trim();
  
  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: 'Business name must be at least 2 characters long'
    };
  }

  if (trimmed.length > 100) {
    return {
      isValid: false,
      error: 'Business name must be less than 100 characters'
    };
  }

  // Check for valid characters (letters, numbers, spaces, common business punctuation)
  const validCharsRegex = /^[a-zA-Z0-9\s\-\.\,\&\'\(\)]+$/;
  if (!validCharsRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Business name contains invalid characters'
    };
  }

  // Check for at least one letter (to prevent names like "123" or "---")
  const hasLetterRegex = /[a-zA-Z]/;
  if (!hasLetterRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Business name must contain at least one letter'
    };
  }

  // Check for excessive repeating characters
  const excessiveRepeatingRegex = /(.)\1{4,}/;
  if (excessiveRepeatingRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Business name contains too many repeating characters'
    };
  }

  return {
    isValid: true,
    error: null
  };
};

// File validation function for secure file uploads
export const validateFile = (file) => {
  const errors = [];
  
  if (!file) {
    return {
      isValid: false,
      errors: ['No file provided']
    };
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 10MB`);
  }

  // Check file type
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/csv', // .csv alternative
    'application/vnd.oasis.opendocument.spreadsheet' // .ods
  ];

  const allowedExtensions = ['.xlsx', '.xls', '.csv', '.ods'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    errors.push('File type not supported. Please upload Excel (.xlsx, .xls), CSV (.csv), or OpenDocument (.ods) files only');
  }

  // Check file name for security
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.com$/i,
    /\.pif$/i,
    /\.scr$/i,
    /\.vbs$/i,
    /\.js$/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
    errors.push('File name contains potentially malicious content');
  }

  // Check for null bytes or control characters in filename
  if (/[\x00-\x1f\x7f-\x9f]/.test(file.name)) {
    errors.push('File name contains invalid characters');
  }

  // File name length check
  if (file.name.length > 255) {
    errors.push('File name is too long (maximum 255 characters)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Inventory item validation function
export const validateInventoryItem = (item) => {
  const errors = [];
  
  if (!item || typeof item !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid item data']
    };
  }

  // Name validation
  if (!item.name || typeof item.name !== 'string') {
    errors.push('Item name is required');
  } else {
    const trimmedName = item.name.trim();
    if (trimmedName.length < 1) {
      errors.push('Item name cannot be empty');
    } else if (trimmedName.length > 100) {
      errors.push('Item name must be less than 100 characters');
    }
    // Check for malicious content
    if (/<script|javascript:|data:|vbscript:/i.test(trimmedName)) {
      errors.push('Item name contains invalid content');
    }
  }

  // Category validation
  if (item.category && typeof item.category === 'string') {
    if (item.category.length > 50) {
      errors.push('Category must be less than 50 characters');
    }
    if (/<script|javascript:|data:|vbscript:/i.test(item.category)) {
      errors.push('Category contains invalid content');
    }
  }

  // Quantity validation
  if (item.quantity === undefined || item.quantity === null) {
    errors.push('Quantity is required');
  } else {
    const qty = Number(item.quantity);
    if (isNaN(qty)) {
      errors.push('Quantity must be a valid number');
    } else if (qty < 0) {
      errors.push('Quantity cannot be negative');
    } else if (qty > 1000000) {
      errors.push('Quantity cannot exceed 1,000,000');
    } else if (!Number.isInteger(qty)) {
      errors.push('Quantity must be a whole number');
    }
  }

  // Unit price validation
  if (item.unitPrice === undefined || item.unitPrice === null) {
    errors.push('Unit price is required');
  } else {
    const price = Number(item.unitPrice);
    if (isNaN(price)) {
      errors.push('Unit price must be a valid number');
    } else if (price < 0) {
      errors.push('Unit price cannot be negative');
    } else if (price > 1000000) {
      errors.push('Unit price cannot exceed £1,000,000');
    }
  }

  // Description validation
  if (item.description && typeof item.description === 'string') {
    if (item.description.length > 500) {
      errors.push('Description must be less than 500 characters');
    }
    if (/<script|javascript:|data:|vbscript:/i.test(item.description)) {
      errors.push('Description contains invalid content');
    }
  }

  // Date validation
  if (item.dateAdded) {
    const date = new Date(item.dateAdded);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date format');
    } else {
      const now = new Date();
      const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
      
      if (date > oneYearFromNow) {
        errors.push('Date cannot be more than one year in the future');
      } else if (date < tenYearsAgo) {
        errors.push('Date cannot be more than 10 years in the past');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .substring(0, 1000); // Limit length
};

export const hashPassword = (password, salt) => {
  if (!password) {
    throw new Error('Password is required');
  }
  
  // Generate salt if not provided
  if (!salt) {
    salt = generateSalt();
  }
  
  // Simple hash implementation for demo purposes
  // In production, use bcrypt or similar
  let hash = 0;
  const combined = password + salt;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return {
    hash: Math.abs(hash).toString(36),
    salt: salt
  };
};

export const generateSalt = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let salt = '';
  
  for (let i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return salt;
};

export const verifyPassword = (plainPassword, hashedPassword, salt) => {
  try {
    const testHash = hashPassword(plainPassword, salt);
    return testHash.hash === hashedPassword;
  } catch (error) {
    secureLog.error('Error verifying password:', error);
    return false;
  }
};

// Password validation function for PasswordStrengthIndicator component
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password is required'],
      strength: { score: 0, strength: 'Very Weak', color: 'red' }
    };
  }

  const errors = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += password.length >= 12 ? 2 : 1;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  // Bonus points for variety and length
  if (password.length >= 16) score += 1;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?].*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 1;
  if (/[0-9].*[0-9]/.test(password)) score += 1;

  // Determine strength
  let strength, color;
  if (score >= 8) {
    strength = 'Very Strong';
    color = 'green';
  } else if (score >= 6) {
    strength = 'Strong';
    color = 'blue';
  } else if (score >= 4) {
    strength = 'Good';
    color = 'yellow';
  } else if (score >= 2) {
    strength = 'Weak';
    color = 'orange';
  } else {
    strength = 'Very Weak';
    color = 'red';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: { score, strength, color }
  };
};

// Session Management Functions
export const createSession = (userData) => {
  try {
    const sessionData = {
      user: {
        email: userData.email,
        businessName: userData.businessName,
        role: userData.role
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TIMEOUT
    };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    secureLog.debug('Session created successfully');
    
    logSecurityEvent('SESSION_CREATED', {
      userEmail: userData.email,
      role: userData.role
    });
    
    return sessionData;
  } catch (error) {
    secureLog.error('Error creating session:', error);
    return null;
  }
};

export const validateSession = () => {
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) {
      return null;
    }
    
    const session = JSON.parse(sessionData);
    const now = Date.now();
    
    // Check if session has expired
    if (now > session.expiresAt) {
      clearSession();
      logSecurityEvent('SESSION_EXPIRED', {
        userEmail: session.user?.email
      });
      return null;
    }
    
    // Extend session if it's still valid
    session.expiresAt = now + SESSION_TIMEOUT;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    
    return session;
  } catch (error) {
    secureLog.error('Error validating session:', error);
    clearSession();
    return null;
  }
};

export const clearSession = () => {
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      logSecurityEvent('SESSION_CLEARED', {
        userEmail: session.user?.email
      });
    }
    
    localStorage.removeItem(SESSION_KEY);
    secureLog.debug('Session cleared successfully');
  } catch (error) {
    secureLog.error('Error clearing session:', error);
    // Force remove even if there's an error
    localStorage.removeItem(SESSION_KEY);
  }
};

export const getSessionData = () => {
  try {
    const session = validateSession();
    return session ? session.user : null;
  } catch (error) {
    secureLog.error('Error getting session data:', error);
    return null;
  }
};

export const checkRateLimit = (email) => {
  try {
    const attempts = JSON.parse(localStorage.getItem(FAILED_ATTEMPTS) || '{}');
    const userAttempts = attempts[email];
    
    if (!userAttempts) {
      return { allowed: true, remainingTime: 0 };
    }
    
    const now = Date.now();
    const timeDifference = now - userAttempts.lastAttempt;
    const minutesPassed = Math.floor(timeDifference / (1000 * 60));
    
    if (minutesPassed >= RATE_LIMIT_DURATION) {
      // Reset attempts after rate limit duration
      delete attempts[email];
      localStorage.setItem(FAILED_ATTEMPTS, JSON.stringify(attempts));
      return { allowed: true, remainingTime: 0 };
    }
    
    if (userAttempts.count >= MAX_ATTEMPTS) {
      const remainingTime = RATE_LIMIT_DURATION - minutesPassed;
      return { allowed: false, remainingTime };
    }
    
    return { allowed: true, remainingTime: 0 };
  } catch (error) {
    secureLog.error('Error checking rate limit:', error);
    return { allowed: true, remainingTime: 0 };
  }
};

export const recordFailedAttempt = (email) => {
  try {
    const attempts = JSON.parse(localStorage.getItem(FAILED_ATTEMPTS) || '{}');
    const now = Date.now();
    
    if (!attempts[email]) {
      attempts[email] = { count: 0, lastAttempt: now };
    }
    
    attempts[email].count += 1;
    attempts[email].lastAttempt = now;
    
    localStorage.setItem(FAILED_ATTEMPTS, JSON.stringify(attempts));
    
    secureLog.debug('Recorded failed login attempt');
  } catch (error) {
    secureLog.error('Error recording failed attempt:', error);
  }
};

export const clearFailedAttempts = (email) => {
  try {
    const attempts = JSON.parse(localStorage.getItem(FAILED_ATTEMPTS) || '{}');
    delete attempts[email];
    localStorage.setItem(FAILED_ATTEMPTS, JSON.stringify(attempts));
    
    secureLog.debug('Cleared failed login attempts');
  } catch (error) {
    secureLog.error('Error clearing failed attempts:', error);
  }
};

export const logSecurityEvent = (eventType, details) => {
  try {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      details: sanitizeInput(JSON.stringify(details)),
      userAgent: navigator.userAgent,
      ip: 'client-side' // In production, this would be logged server-side
    };
    
    // In production, send this to a secure logging service
    secureLog.debug('Security event logged:', event);
    
    // Store locally for admin review (in production, use secure server-side logging)
    const securityLogs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    securityLogs.push(event);
    
    // Keep only last 100 events to prevent storage bloat
    if (securityLogs.length > 100) {
      securityLogs.splice(0, securityLogs.length - 100);
    }
    
    localStorage.setItem('security_logs', JSON.stringify(securityLogs));
  } catch (error) {
    secureLog.error('Error logging security event:', error);
  }
};

export const getSecurityLogs = () => {
  try {
    return JSON.parse(localStorage.getItem('security_logs') || '[]');
  } catch (error) {
    secureLog.error('Error getting security logs:', error);
    return [];
  }
};

export const clearSecurityLogs = () => {
  try {
    localStorage.removeItem('security_logs');
    secureLog.debug('Security logs cleared');
  } catch (error) {
    secureLog.error('Error clearing security logs:', error);
  }
};

// Password strength validation (alternative function name for compatibility)
export const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const score = [
    password.length >= minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar
  ].filter(Boolean).length;
  
  let strength = 'weak';
  if (score >= 4) strength = 'strong';
  else if (score >= 3) strength = 'medium';
  
  return {
    score,
    strength,
    requirements: {
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar
    }
  };
};

// Input sanitization for XSS prevention
export const sanitizeHtml = (html) => {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

// CSP violation handler
export const handleCSPViolation = (event) => {
  logSecurityEvent('CSP_VIOLATION', {
    blockedURI: event.blockedURI,
    violatedDirective: event.violatedDirective,
    originalPolicy: event.originalPolicy
  });
};

// Set up CSP violation reporting
if (typeof window !== 'undefined') {
  document.addEventListener('securitypolicyviolation', handleCSPViolation);
}