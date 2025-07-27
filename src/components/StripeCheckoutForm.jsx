import { useState } from 'react';
import { RiLockLine, RiInformationLine } from 'react-icons/ri';
import { motion } from 'framer-motion';
import { logSecurityEvent } from '../utils/security';

export default function StripeCheckoutForm({
  amount,
  currency = 'gbp',
  planId,
  billingInterval,
  onSuccess,
  onError,
  onCancel,
  buttonText = "Subscribe"
}) {
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
    address: {
      city: '',
      line1: '',
      postal_code: '',
      country: 'GB',
    },
  });
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvc: '',
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc) {
      setError('Please complete your card details');
      return;
    }

    if (!billingDetails.name) {
      setError('Please provide your name');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      logSecurityEvent('PAYMENT_FORM_SUBMISSION', {
        amount,
        currency,
        planId,
        billingInterval
      });

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful payment
      const mockResult = {
        paymentMethodId: `pm_${Date.now()}`,
        customerId: 'cus_mock123',
        subscriptionId: 'sub_mock123',
        planId,
        billingInterval
      };

      logSecurityEvent('PAYMENT_SUCCESS', {
        paymentMethodId: mockResult.paymentMethodId,
        planId,
        billingInterval
      });

      onSuccess(mockResult);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      logSecurityEvent('PAYMENT_PROCESSING_ERROR', {
        error: err.message
      });
      onError(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleBillingChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setBillingDetails(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setBillingDetails(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleCardChange = (field, value) => {
    setCardDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Demo Notice */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <RiInformationLine className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
          <div>
            <p className="text-blue-300 text-sm">
              <strong>Demo Mode</strong> - Use these test card details:
            </p>
            <p className="text-blue-300 text-xs mt-1">
              Card number: <code className="bg-blue-900/50 px-1 rounded">4242 4242 4242 4242</code>
            </p>
            <p className="text-blue-300 text-xs mt-1">
              Any future date, any 3 digits for CVC, and any postal code.
            </p>
          </div>
        </div>
      </div>

      {/* Billing Details */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Full name
          </label>
          <input
            type="text"
            value={billingDetails.name}
            onChange={(e) => handleBillingChange('name', e.target.value)}
            required
            placeholder="Jane Doe"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Email
          </label>
          <input
            type="email"
            value={billingDetails.email}
            onChange={(e) => handleBillingChange('email', e.target.value)}
            required
            placeholder="jane.doe@example.com"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Card Details */}
        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Card Number
          </label>
          <input
            type="text"
            value={cardDetails.number}
            onChange={(e) => handleCardChange('number', e.target.value)}
            required
            placeholder="1234 5678 9012 3456"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Expiry Date
            </label>
            <input
              type="text"
              value={cardDetails.expiry}
              onChange={(e) => handleCardChange('expiry', e.target.value)}
              required
              placeholder="MM/YY"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              CVC
            </label>
            <input
              type="text"
              value={cardDetails.cvc}
              onChange={(e) => handleCardChange('cvc', e.target.value)}
              required
              placeholder="123"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-red-900/50 border border-red-700 rounded-md"
        >
          <p className="text-red-300 text-sm">{error}</p>
        </motion.div>
      )}

      {/* Security Notice */}
      <div className="flex items-center text-xs text-gray-400 mb-4">
        <RiLockLine className="h-4 w-4 mr-1" />
        <span>Your payment information is encrypted and secure</span>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={processing}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex-1 disabled:opacity-50"
        >
          {processing ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Processing...
            </div>
          ) : (
            buttonText
          )}
        </button>
      </div>
    </motion.form>
  );
}