import {getUserByEmail, getAllUsers} from './db';
import {logSecurityEvent, generateResetToken, verifyToken, hashPassword} from '../utils/security';

// Request password reset
export const requestPasswordReset = async (email) => {
  try {
    // Check if user exists
    const user = await getUserByEmail(email);
    if (!user) {
      // We don't want to reveal whether an email exists in our system for security reasons,
      // so we'll still return success even if the user doesn't exist
      return { success: true };
    }

    // Generate reset token
    const resetToken = generateResetToken(email);

    // Store token in localStorage for demo purposes
    // In a real application, this would be stored in a database and sent via email
    const resetRequests = JSON.parse(localStorage.getItem('password_reset_requests') || '{}');
    resetRequests[email] = {
      token: resetToken,
      expires: Date.now() + 3600000, // 1 hour expiry
      created: Date.now()
    };
    localStorage.setItem('password_reset_requests', JSON.stringify(resetRequests));

    // In a real app, we would send an email here
    console.log(`Password reset link: ${window.location.origin}/#/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`);

    // Log the event
    logSecurityEvent('PASSWORD_RESET_REQUESTED', { email });

    return { success: true };
  } catch (error) {
    console.error('Error requesting password reset:', error);
    logSecurityEvent('PASSWORD_RESET_REQUEST_ERROR', { email, error: error.message });
    throw new Error('Failed to process password reset request. Please try again later.');
  }
};

// Verify reset token
export const verifyResetToken = async (token, email) => {
  try {
    // Get stored tokens
    const resetRequests = JSON.parse(localStorage.getItem('password_reset_requests') || '{}');
    const request = resetRequests[email];

    // Check if request exists and is valid
    if (!request || request.token !== token || Date.now() > request.expires) {
      throw new Error('Invalid or expired reset token');
    }

    return { valid: true };
  } catch (error) {
    console.error('Error verifying reset token:', error);
    logSecurityEvent('PASSWORD_RESET_TOKEN_INVALID', { email, error: error.message });
    throw new Error('This password reset link is invalid or has expired.');
  }
};

// Reset password
export const resetPassword = async (token, email, newPassword) => {
  try {
    // Verify token first
    await verifyResetToken(token, email);

    // Get user
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Hash new password
    const hashedPassword = hashPassword(newPassword);

    // Update user's password in localStorage for demo purposes
    // In a real app, this would update the database
    const allUsers = JSON.parse(localStorage.getItem('trackio_users') || '[]');
    const updatedUsers = allUsers.map(u => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return {
          ...u,
          password: hashedPassword.hash,
          salt: hashedPassword.salt,
          passwordUpdatedAt: new Date().toISOString()
        };
      }
      return u;
    });
    localStorage.setItem('trackio_users', JSON.stringify(updatedUsers));

    // Remove the reset request
    const resetRequests = JSON.parse(localStorage.getItem('password_reset_requests') || '{}');
    delete resetRequests[email];
    localStorage.setItem('password_reset_requests', JSON.stringify(resetRequests));

    // Log the event
    logSecurityEvent('PASSWORD_RESET_COMPLETED', { email });

    return { success: true };
  } catch (error) {
    console.error('Error resetting password:', error);
    logSecurityEvent('PASSWORD_RESET_ERROR', { email, error: error.message });
    throw new Error('Failed to reset password. Please try again.');
  }
};

// Platform admin function to change user password
export const adminChangeUserPassword = async (adminEmail, targetEmail, newPassword) => {
  try {
    // Verify admin has permission
    const admin = await getUserByEmail(adminEmail);
    if (!admin || admin.role !== 'platformadmin') {
      throw new Error('Insufficient permissions. Only platform administrators can change user passwords.');
    }

    // Get target user
    const targetUser = await getUserByEmail(targetEmail);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Prevent changing other platform admin passwords
    if (targetUser.role === 'platformadmin' && targetEmail !== adminEmail) {
      throw new Error('Cannot change password of another platform administrator');
    }

    // Hash new password
    const hashedPassword = hashPassword(newPassword);

    // Update user's password
    const allUsers = JSON.parse(localStorage.getItem('trackio_users') || '[]');
    const updatedUsers = allUsers.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        return {
          ...u,
          password: hashedPassword.hash,
          salt: hashedPassword.salt,
          passwordUpdatedAt: new Date().toISOString(),
          passwordChangedBy: adminEmail
        };
      }
      return u;
    });
    localStorage.setItem('trackio_users', JSON.stringify(updatedUsers));

    // Log the event
    logSecurityEvent('ADMIN_PASSWORD_CHANGE', { 
      adminEmail, 
      targetEmail,
      targetRole: targetUser.role 
    });

    return { success: true };
  } catch (error) {
    console.error('Error changing user password:', error);
    logSecurityEvent('ADMIN_PASSWORD_CHANGE_ERROR', { 
      adminEmail, 
      targetEmail, 
      error: error.message 
    });
    throw error;
  }
};

// Generate temporary password for admin use
export const generateTemporaryPassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  
  // Ensure at least one of each required type
  password += 'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)]; // Uppercase
  password += 'abcdefghijkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]; // Lowercase
  password += '23456789'[Math.floor(Math.random() * 8)]; // Number
  password += '!@#$%&*'[Math.floor(Math.random() * 7)]; // Special char
  
  // Fill remaining positions
  for (let i = 4; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Get password reset requests (for admin monitoring)
export const getPasswordResetRequests = async (adminEmail) => {
  try {
    const admin = await getUserByEmail(adminEmail);
    if (!admin || admin.role !== 'platformadmin') {
      throw new Error('Insufficient permissions');
    }

    const resetRequests = JSON.parse(localStorage.getItem('password_reset_requests') || '{}');
    
    // Return active requests with user info
    const activeRequests = [];
    for (const [email, request] of Object.entries(resetRequests)) {
      if (Date.now() < request.expires) {
        const user = await getUserByEmail(email);
        if (user) {
          activeRequests.push({
            email,
            businessName: user.businessName,
            role: user.role,
            requestedAt: new Date(request.created).toISOString(),
            expiresAt: new Date(request.expires).toISOString()
          });
        }
      }
    }

    return activeRequests;
  } catch (error) {
    console.error('Error getting password reset requests:', error);
    throw error;
  }
};

// Cancel password reset request (admin function)
export const cancelPasswordReset = async (adminEmail, targetEmail) => {
  try {
    const admin = await getUserByEmail(adminEmail);
    if (!admin || admin.role !== 'platformadmin') {
      throw new Error('Insufficient permissions');
    }

    const resetRequests = JSON.parse(localStorage.getItem('password_reset_requests') || '{}');
    delete resetRequests[targetEmail];
    localStorage.setItem('password_reset_requests', JSON.stringify(resetRequests));

    logSecurityEvent('ADMIN_CANCELLED_PASSWORD_RESET', { adminEmail, targetEmail });

    return { success: true };
  } catch (error) {
    console.error('Error cancelling password reset:', error);
    throw error;
  }
};