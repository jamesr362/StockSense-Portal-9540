import {getUserByEmail} from './db';
import {logSecurityEvent,generateResetToken,verifyToken,hashPassword} from '../utils/security';
import {sendPasswordResetEmail} from './email';

// Request password reset
export const requestPasswordReset=async (email)=> {
  try {
    // Check if user exists
    const user=await getUserByEmail(email);
    if (!user) {
      // We don't want to reveal whether an email exists in our system for security reasons,
      // so we'll still return success even if the user doesn't exist
      return {success: true};
    }

    // Generate reset token
    const resetToken=generateResetToken(email);

    // Store token in localStorage for demo purposes
    // In a real application, this would be stored in a database and sent via email
    const resetRequests=JSON.parse(localStorage.getItem('password_reset_requests') || '{}');
    resetRequests[email]={
      token: resetToken,
      expires: Date.now() + 3600000,// 1 hour expiry
    };
    localStorage.setItem('password_reset_requests',JSON.stringify(resetRequests));

    // Create reset link
    const resetLink=`${window.location.origin}/#/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Try to send email if email service is configured
    try {
      const emailResult=await sendPasswordResetEmail(email,resetLink);
      console.log('Password reset email result:',emailResult);
    } catch (emailError) {
      console.log('Email service not available or failed:',emailError.message);
      // Fallback to console log for demo
      console.log(`Password reset link: ${resetLink}`);
    }

    // Log the event
    logSecurityEvent('PASSWORD_RESET_REQUESTED',{email});

    return {success: true};
  } catch (error) {
    console.error('Error requesting password reset:',error);
    logSecurityEvent('PASSWORD_RESET_REQUEST_ERROR',{
      email,
      error: error.message
    });
    throw new Error('Failed to process password reset request. Please try again later.');
  }
};

// Verify reset token
export const verifyResetToken=async (token,email)=> {
  try {
    // Get stored tokens
    const resetRequests=JSON.parse(localStorage.getItem('password_reset_requests') || '{}');
    const request=resetRequests[email];

    // Check if request exists and is valid
    if (!request || request.token !==token || Date.now() > request.expires) {
      throw new Error('Invalid or expired reset token');
    }

    return {valid: true};
  } catch (error) {
    console.error('Error verifying reset token:',error);
    logSecurityEvent('PASSWORD_RESET_TOKEN_INVALID',{
      email,
      error: error.message
    });
    throw new Error('This password reset link is invalid or has expired.');
  }
};

// Reset password
export const resetPassword=async (token,email,newPassword)=> {
  try {
    // Verify token first
    await verifyResetToken(token,email);

    // Get user
    const user=await getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Hash new password
    const hashedPassword=hashPassword(newPassword);

    // Update user's password in localStorage for demo purposes
    // In a real app, this would update the database
    const allUsers=JSON.parse(localStorage.getItem('trackio_users') || '[]');
    const updatedUsers=allUsers.map(u=> {
      if (u.email.toLowerCase()===email.toLowerCase()) {
        return {
          ...u,
          password: hashedPassword.hash,
          salt: hashedPassword.salt
        };
      }
      return u;
    });
    localStorage.setItem('trackio_users',JSON.stringify(updatedUsers));

    // Remove the reset request
    const resetRequests=JSON.parse(localStorage.getItem('password_reset_requests') || '{}');
    delete resetRequests[email];
    localStorage.setItem('password_reset_requests',JSON.stringify(resetRequests));

    // Log the event
    logSecurityEvent('PASSWORD_RESET_COMPLETED',{email});

    return {success: true};
  } catch (error) {
    console.error('Error resetting password:',error);
    logSecurityEvent('PASSWORD_RESET_ERROR',{
      email,
      error: error.message
    });
    throw new Error('Failed to reset password. Please try again.');
  }
};