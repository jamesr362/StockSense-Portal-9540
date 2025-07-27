// Email service integration
import {logSecurityEvent} from '../utils/security';

// Email service providers
export const EMAIL_PROVIDERS = {
  SMTP: 'smtp',
  SENDGRID: 'sendgrid',
  MAILGUN: 'mailgun',
  SES: 'ses', // Amazon SES
  POSTMARK: 'postmark'
};

// Email template types
export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
  LOW_STOCK_ALERT: 'low_stock_alert',
  SUBSCRIPTION_CONFIRMATION: 'subscription_confirmation',
  PAYMENT_FAILED: 'payment_failed',
  ACCOUNT_SUSPENDED: 'account_suspended',
  SYSTEM_NOTIFICATION: 'system_notification'
};

// Get email configuration
export const getEmailConfig = () => {
  try {
    const config = localStorage.getItem('email_config');
    return config ? JSON.parse(config) : getDefaultEmailConfig();
  } catch (error) {
    console.error('Error loading email config:', error);
    return getDefaultEmailConfig();
  }
};

// Default email configuration
const getDefaultEmailConfig = () => ({
  provider: EMAIL_PROVIDERS.SMTP,
  enabled: false,
  settings: {
    smtp: {
      host: '',
      port: 587,
      secure: false,
      auth: {
        user: '',
        pass: ''
      }
    },
    sendgrid: {
      apiKey: ''
    },
    mailgun: {
      apiKey: '',
      domain: ''
    },
    ses: {
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1'
    },
    postmark: {
      serverToken: ''
    }
  },
  fromEmail: 'noreply@trackio.com',
  fromName: 'Trackio',
  replyTo: 'support@trackio.com',
  templates: {
    [EMAIL_TEMPLATES.WELCOME]: {
      subject: 'Welcome to Trackio!',
      enabled: true,
      template: `
        <h2>Welcome to Trackio!</h2>
        <p>Hi {{name}},</p>
        <p>Thank you for joining Trackio. We're excited to help you manage your inventory efficiently.</p>
        <p>Get started by:</p>
        <ul>
          <li>Adding your first inventory items</li>
          <li>Setting up low stock alerts</li>
          <li>Exploring our receipt scanner feature</li>
        </ul>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Trackio Team</p>
      `
    },
    [EMAIL_TEMPLATES.PASSWORD_RESET]: {
      subject: 'Reset Your Trackio Password',
      enabled: true,
      template: `
        <h2>Password Reset Request</h2>
        <p>Hi {{name}},</p>
        <p>We received a request to reset your password for your Trackio account.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="{{resetLink}}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>The Trackio Team</p>
      `
    },
    [EMAIL_TEMPLATES.LOW_STOCK_ALERT]: {
      subject: 'Low Stock Alert - {{itemName}}',
      enabled: true,
      template: `
        <h2>Low Stock Alert</h2>
        <p>Hi {{name}},</p>
        <p>Your inventory item <strong>{{itemName}}</strong> is running low.</p>
        <p><strong>Current Stock:</strong> {{currentStock}}</p>
        <p><strong>Minimum Threshold:</strong> {{minThreshold}}</p>
        <p>Consider restocking this item soon to avoid running out.</p>
        <p><a href="{{dashboardLink}}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Inventory</a></p>
        <p>Best regards,<br>The Trackio Team</p>
      `
    },
    [EMAIL_TEMPLATES.SUBSCRIPTION_CONFIRMATION]: {
      subject: 'Subscription Confirmed - Welcome to {{planName}}!',
      enabled: true,
      template: `
        <h2>Subscription Confirmed!</h2>
        <p>Hi {{name}},</p>
        <p>Thank you for upgrading to the <strong>{{planName}}</strong> plan!</p>
        <p><strong>Plan Details:</strong></p>
        <ul>
          <li>Plan: {{planName}}</li>
          <li>Billing: {{billingInterval}}</li>
          <li>Amount: {{amount}}</li>
          <li>Next billing date: {{nextBillingDate}}</li>
        </ul>
        <p>You now have access to all premium features. Enjoy!</p>
        <p><a href="{{dashboardLink}}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Access Dashboard</a></p>
        <p>Best regards,<br>The Trackio Team</p>
      `
    },
    [EMAIL_TEMPLATES.PAYMENT_FAILED]: {
      subject: 'Payment Failed - Action Required',
      enabled: true,
      template: `
        <h2>Payment Failed</h2>
        <p>Hi {{name}},</p>
        <p>We were unable to process your payment for your Trackio subscription.</p>
        <p><strong>Plan:</strong> {{planName}}</p>
        <p><strong>Amount:</strong> {{amount}}</p>
        <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
        <p>Please update your payment information to continue using Trackio without interruption.</p>
        <p><a href="{{billingLink}}" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Update Payment Method</a></p>
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>The Trackio Team</p>
      `
    }
  }
});

// Save email configuration
export const saveEmailConfig = (config) => {
  try {
    localStorage.setItem('email_config', JSON.stringify(config));
    logSecurityEvent('EMAIL_CONFIG_UPDATED', {
      provider: config.provider,
      enabled: config.enabled
    });
    return true;
  } catch (error) {
    console.error('Error saving email config:', error);
    logSecurityEvent('EMAIL_CONFIG_SAVE_ERROR', {
      error: error.message
    });
    return false;
  }
};

// Test email configuration
export const testEmailConfig = async (config, testEmail) => {
  try {
    logSecurityEvent('EMAIL_TEST_INITIATED', {
      provider: config.provider,
      testEmail
    });

    // In a real implementation, this would actually send a test email
    // For demo purposes, we'll simulate the test
    await new Promise(resolve => setTimeout(resolve, 2000));

    const testResult = {
      success: true,
      message: 'Test email sent successfully!',
      details: {
        provider: config.provider,
        to: testEmail,
        timestamp: new Date().toISOString()
      }
    };

    logSecurityEvent('EMAIL_TEST_SUCCESS', {
      provider: config.provider,
      testEmail
    });

    return testResult;
  } catch (error) {
    const testResult = {
      success: false,
      message: 'Failed to send test email',
      error: error.message
    };

    logSecurityEvent('EMAIL_TEST_FAILED', {
      provider: config.provider,
      error: error.message
    });

    return testResult;
  }
};

// Send email using configured provider
export const sendEmail = async (emailData) => {
  const config = getEmailConfig();
  
  if (!config.enabled) {
    throw new Error('Email service is not enabled');
  }

  try {
    logSecurityEvent('EMAIL_SEND_INITIATED', {
      provider: config.provider,
      to: emailData.to,
      template: emailData.template
    });

    // In a real implementation, this would route to the appropriate email service
    // For demo purposes, we'll simulate sending
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Process template if provided
    let emailContent = emailData.content;
    if (emailData.template && config.templates[emailData.template]) {
      const template = config.templates[emailData.template];
      emailContent = processEmailTemplate(template.template, emailData.variables || {});
    }

    const emailResult = {
      messageId: `msg_${Date.now()}`,
      provider: config.provider,
      to: emailData.to,
      subject: emailData.subject,
      timestamp: new Date().toISOString()
    };

    logSecurityEvent('EMAIL_SENT_SUCCESS', {
      messageId: emailResult.messageId,
      provider: config.provider,
      to: emailData.to
    });

    return emailResult;
  } catch (error) {
    logSecurityEvent('EMAIL_SEND_FAILED', {
      provider: config.provider,
      to: emailData.to,
      error: error.message
    });
    
    throw error;
  }
};

// Process email template with variables
const processEmailTemplate = (template, variables) => {
  let processedTemplate = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processedTemplate = processedTemplate.replace(regex, value || '');
  });
  
  return processedTemplate;
};

// Send welcome email
export const sendWelcomeEmail = async (userData) => {
  const config = getEmailConfig();
  
  if (!config.enabled || !config.templates[EMAIL_TEMPLATES.WELCOME].enabled) {
    return { skipped: true, reason: 'Welcome emails are disabled' };
  }

  return await sendEmail({
    to: userData.email,
    template: EMAIL_TEMPLATES.WELCOME,
    subject: config.templates[EMAIL_TEMPLATES.WELCOME].subject,
    variables: {
      name: userData.businessName || userData.email,
      email: userData.email
    }
  });
};

// Send password reset email
export const sendPasswordResetEmail = async (email, resetLink) => {
  const config = getEmailConfig();
  
  if (!config.enabled || !config.templates[EMAIL_TEMPLATES.PASSWORD_RESET].enabled) {
    return { skipped: true, reason: 'Password reset emails are disabled' };
  }

  return await sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.PASSWORD_RESET,
    subject: config.templates[EMAIL_TEMPLATES.PASSWORD_RESET].subject,
    variables: {
      name: email,
      resetLink
    }
  });
};

// Send low stock alert
export const sendLowStockAlert = async (userEmail, itemData) => {
  const config = getEmailConfig();
  
  if (!config.enabled || !config.templates[EMAIL_TEMPLATES.LOW_STOCK_ALERT].enabled) {
    return { skipped: true, reason: 'Low stock alerts are disabled' };
  }

  return await sendEmail({
    to: userEmail,
    template: EMAIL_TEMPLATES.LOW_STOCK_ALERT,
    subject: config.templates[EMAIL_TEMPLATES.LOW_STOCK_ALERT].subject.replace('{{itemName}}', itemData.name),
    variables: {
      name: userEmail,
      itemName: itemData.name,
      currentStock: itemData.quantity,
      minThreshold: itemData.minThreshold || 5,
      dashboardLink: `${window.location.origin}/#/inventory`
    }
  });
};

// Get email statistics
export const getEmailStats = () => {
  try {
    const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    const emailLogs = logs.filter(log => log.event.includes('EMAIL_'));
    
    const stats = {
      totalSent: emailLogs.filter(log => log.event === 'EMAIL_SENT_SUCCESS').length,
      totalFailed: emailLogs.filter(log => log.event === 'EMAIL_SEND_FAILED').length,
      totalTests: emailLogs.filter(log => log.event.includes('EMAIL_TEST')).length,
      recentEmails: emailLogs
        .filter(log => log.event === 'EMAIL_SENT_SUCCESS')
        .slice(0, 10)
        .map(log => ({
          timestamp: log.timestamp,
          to: log.details.to,
          template: log.details.template
        }))
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting email stats:', error);
    return {
      totalSent: 0,
      totalFailed: 0,
      totalTests: 0,
      recentEmails: []
    };
  }
};