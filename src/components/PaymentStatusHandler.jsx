import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiCheckLine, RiCloseLine, RiAlertLine, RiRefreshLine } from 'react-icons/ri';
import { usePaymentVerification } from '../hooks/usePaymentVerification';

export default function PaymentStatusHandler() {
  const {
    isVerifying,
    verificationStatus,
    error,
    dismissVerificationStatus,
    retryVerification
  } = usePaymentVerification();

  // Auto-dismiss success messages after 10 seconds
  useEffect(() => {
    if (verificationStatus?.success && !verificationStatus.pending) {
      const timer = setTimeout(() => {
        dismissVerificationStatus();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [verificationStatus, dismissVerificationStatus]);

  if (!isVerifying && !verificationStatus && !error) {
    return null;
  }

  return (
    <AnimatePresence>
      {(isVerifying || verificationStatus || error) && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-0 left-0 right-0 z-50"
        >
          {/* Verifying Payment */}
          {isVerifying && (
            <div className="bg-blue-600 text-white px-4 py-3 shadow-lg">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  <span className="font-medium">Verifying your payment...</span>
                </div>
              </div>
            </div>
          )}

          {/* Success Status */}
          {verificationStatus?.success && (
            <div className="bg-green-600 text-white px-4 py-4 shadow-lg">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {verificationStatus.pending ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    ) : (
                      <RiCheckLine className="h-6 w-6 mr-3" />
                    )}
                    <div>
                      <div className="font-semibold">{verificationStatus.message}</div>
                      {verificationStatus.features && (
                        <div className="text-green-100 text-sm mt-1">
                          Now available: {verificationStatus.features.slice(0, 3).join(', ')}
                          {verificationStatus.features.length > 3 && ` +${verificationStatus.features.length - 3} more`}
                        </div>
                      )}
                    </div>
                  </div>
                  {!verificationStatus.pending && (
                    <button
                      onClick={dismissVerificationStatus}
                      className="text-green-100 hover:text-white p-1"
                    >
                      <RiCloseLine className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Status */}
          {(verificationStatus && !verificationStatus.success) || error && (
            <div className="bg-red-600 text-white px-4 py-4 shadow-lg">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <RiAlertLine className="h-6 w-6 mr-3 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">
                        {verificationStatus?.message || error || 'Payment verification failed'}
                      </div>
                      {verificationStatus?.action === 'retry' && (
                        <div className="text-red-100 text-sm mt-1">
                          You can try the payment again or contact support if you need help.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {verificationStatus?.action === 'retry' && (
                      <button
                        onClick={retryVerification}
                        className="inline-flex items-center px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors text-sm font-medium"
                      >
                        <RiRefreshLine className="h-4 w-4 mr-2" />
                        Retry Verification
                      </button>
                    )}
                    {verificationStatus?.action === 'contact_support' && (
                      <a
                        href="mailto:support@trackio.com"
                        className="inline-flex items-center px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors text-sm font-medium"
                      >
                        Contact Support
                      </a>
                    )}
                    <button
                      onClick={dismissVerificationStatus}
                      className="text-red-100 hover:text-white p-1"
                    >
                      <RiCloseLine className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}