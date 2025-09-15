import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  verifyPaymentCompletion, 
  checkPaymentFromUrl, 
  pollForSubscriptionUpdate,
  subscribeToSubscriptionUpdates 
} from '../services/paymentVerification';
import { logSecurityEvent } from '../utils/security';

export const usePaymentVerification = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Check for payment completion on mount
  useEffect(() => {
    const { hasPaymentParams, paymentStatus, sessionId, planId } = checkPaymentFromUrl();
    
    if (hasPaymentParams && user?.email) {
      handlePaymentVerification(paymentStatus, sessionId, planId);
    }
  }, [user?.email]);

  // Set up real-time subscription listener
  useEffect(() => {
    if (!user?.email) return;

    const subscription = subscribeToSubscriptionUpdates(
      user.email,
      (subscriptionData) => {
        if (subscriptionData.status === 'active') {
          setVerificationStatus({
            success: true,
            message: 'Your subscription has been activated!',
            subscription: subscriptionData
          });
          setIsVerifying(false);
        }
      }
    );

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [user?.email]);

  const handlePaymentVerification = useCallback(async (paymentStatus, sessionId, planId) => {
    if (!user?.email) return;

    try {
      setIsVerifying(true);
      setError(null);
      
      logSecurityEvent('PAYMENT_VERIFICATION_INITIATED', {
        userEmail: user.email,
        paymentStatus,
        sessionId,
        planId
      });

      // Method 1: Direct API verification (if sessionId available)
      if (sessionId) {
        const verificationResult = await verifyPaymentCompletion(sessionId, user.email);
        
        if (verificationResult.success) {
          setVerificationStatus({
            success: true,
            message: 'Payment verified successfully!',
            subscription: verificationResult.subscription
          });
          setIsVerifying(false);
          return;
        }
      }

      // Method 2: Check for successful payment status
      if (paymentStatus === 'success' || paymentStatus === 'completed') {
        // Start polling for subscription update
        const pollResult = await pollForSubscriptionUpdate(user.email);
        
        if (pollResult.success) {
          setVerificationStatus({
            success: true,
            message: 'Your Professional plan has been activated!',
            subscription: pollResult.subscription,
            features: [
              'Unlimited inventory items',
              'Unlimited receipt scans', 
              'Unlimited Excel imports',
              'Professional tax exports'
            ]
          });
        } else {
          // Fallback: Assume success and let webhook handle it
          setVerificationStatus({
            success: true,
            message: 'Payment completed! Your plan will be activated shortly.',
            pending: true
          });
          
          // Continue polling in background
          setTimeout(async () => {
            const retryResult = await pollForSubscriptionUpdate(user.email, 5);
            if (retryResult.success) {
              setVerificationStatus(prev => ({
                ...prev,
                pending: false,
                message: 'Your Professional plan is now active!'
              }));
            }
          }, 10000); // Wait 10 seconds then retry
        }
      } else if (paymentStatus === 'canceled' || paymentStatus === 'failed') {
        setVerificationStatus({
          success: false,
          message: 'Payment was not completed. Please try again.',
          action: 'retry'
        });
      }

    } catch (error) {
      console.error('Payment verification error:', error);
      setError(error.message);
      setVerificationStatus({
        success: false,
        message: 'Unable to verify payment. Please contact support if you were charged.',
        action: 'contact_support'
      });
    } finally {
      setIsVerifying(false);
    }
  }, [user?.email]);

  const dismissVerificationStatus = useCallback(() => {
    setVerificationStatus(null);
    setError(null);
    
    // Clean up URL parameters
    const url = new URL(window.location);
    url.searchParams.delete('payment_status');
    url.searchParams.delete('session_id');
    url.searchParams.delete('plan');
    window.history.replaceState({}, '', url);
  }, []);

  const retryVerification = useCallback(async () => {
    if (!user?.email) return;
    
    setError(null);
    const pollResult = await pollForSubscriptionUpdate(user.email, 3);
    
    if (pollResult.success) {
      setVerificationStatus({
        success: true,
        message: 'Your subscription has been activated!',
        subscription: pollResult.subscription
      });
    } else {
      setError('Still unable to verify payment. Please contact support.');
    }
  }, [user?.email]);

  return {
    isVerifying,
    verificationStatus,
    error,
    dismissVerificationStatus,
    retryVerification,
    handlePaymentVerification
  };
};

export default usePaymentVerification;