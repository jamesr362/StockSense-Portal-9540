import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { RiLockLine, RiShieldCheckLine, RiCreditCardLine } from 'react-icons/ri';
import { logSecurityEvent } from '../utils/security';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#9CA3AF',
      },
    },
    invalid: {
      color: '#EF4444',
      iconColor: '#EF4444',
    },
  },
  hidePostalCode: false,
};

export default function PaymentForm({
  amount,
  currency = 'gbp',
  onSuccess,
  onError,
  isProcessing = false,
  showBillingAddress = true,
  customerId = null,
  metadata = {}
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      postal_code: '',
      country: 'GB',
    },
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      logSecurityEvent('PAYMENT_FORM_SUBMISSION', { amount, currency });

      const cardElement = elements.getElement(CardElement);

      // Create payment method
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: billingDetails,
      });

      if (pmError) {
        setError(pmError.message);
        logSecurityEvent('PAYMENT_METHOD_ERROR', { error: pmError.message });
        return;
      }

      // Process payment
      const response = await fetch('/api/stripe/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount * 100, // Convert to cents
          currency,
          payment_method: paymentMethod.id,
          customer_id: customerId,
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error('Payment processing failed');
      }

      const { client_secret } = await response.json();

      // Confirm payment
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: paymentMethod.id,
        }
      );

      if (confirmError) {
        setError(confirmError.message);
        logSecurityEvent('PAYMENT_CONFIRMATION_ERROR', { error: confirmError.message });
        return;
      }

      logSecurityEvent('PAYMENT_SUCCESS', { paymentIntentId: paymentIntent.id });
      onSuccess(paymentIntent);
    } catch (err) {
      setError(err.message);
      logSecurityEvent('PAYMENT_PROCESSING_ERROR', { error: err.message });
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto bg-gray-800 rounded-lg p-6 shadow-xl"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-2">
          <RiCreditCardLine className="h-8 w-8 text-primary-400" />
        </div>
        <h3 className="text-xl font-semibold text-white">Secure Payment</h3>
        <p className="text-gray-400 text-sm mt-1">
          Your payment information is encrypted and secure
        </p>
      </div>

      {/* Security badges */}
      <div className="flex items-center justify-center space-x-4 mb-6 p-3 bg-gray-700 rounded-lg">
        <div className="flex items-center text-green-400">
          <RiLockLine className="h-4 w-4 mr-1" />
          <span className="text-xs">SSL Encrypted</span>
        </div>
        <div className="flex items-center text-blue-400">
          <RiShieldCheckLine className="h-4 w-4 mr-1" />
          <span className="text-xs">PCI Compliant</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Billing Details */}
        {showBillingAddress && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white">Billing Information</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={billingDetails.name}
                  onChange={(e) => handleBillingChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={billingDetails.email}
                  onChange={(e) => handleBillingChange('email', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Address
              </label>
              <input
                type="text"
                value={billingDetails.address.line1}
                onChange={(e) => handleBillingChange('address.line1', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="123 Main Street"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={billingDetails.address.city}
                  onChange={(e) => handleBillingChange('address.city', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="London"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={billingDetails.address.postal_code}
                  onChange={(e) => handleBillingChange('address.postal_code', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="SW1A 1AA"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* Card Element */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Card Details
          </label>
          <div className="p-3 bg-gray-700 border border-gray-600 rounded-md">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
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

        {/* Amount Summary */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Total Amount:</span>
            <span className="text-xl font-bold text-white">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: currency.toUpperCase(),
              }).format(amount)}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!stripe || processing || isProcessing}
          className="w-full py-3 px-6 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {processing || isProcessing ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Processing...
            </div>
          ) : (
            `Pay ${new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: currency.toUpperCase(),
            }).format(amount)}`
          )}
        </button>

        {/* Trust indicators */}
        <div className="text-center text-xs text-gray-400 space-y-1">
          <p>Powered by Stripe - Your payment information is secure</p>
          <p>We never store your card details on our servers</p>
        </div>
      </form>
    </motion.div>
  );
}