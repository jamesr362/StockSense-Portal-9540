import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { RiLockLine, RiInformationLine } from 'react-icons/ri';
import { motion } from 'framer-motion';
import { logSecurityEvent } from '../utils/security';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  },
  hidePostalCode: false,
};

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
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [cardComplete, setCardComplete] = useState(false);
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not loaded yet. Make sure to disable
      // form submission until Stripe.js has loaded.
      return;
    }

    if (!cardComplete) {
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

      // Here you would normally make a call to your backend to create a subscription
      // For demo purposes, we're just simulating success
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logSecurityEvent('PAYMENT_SUCCESS', { 
        paymentMethodId: paymentMethod.id,
        planId,
        billingInterval
      });
      
      onSuccess({
        paymentMethodId: paymentMethod.id,
        customerId: 'cus_mock123',
        subscriptionId: 'sub_mock123',
        planId,
        billingInterval
      });
      
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      logSecurityEvent('PAYMENT_PROCESSING_ERROR', { error: err.message });
      onError(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleCardChange = (event) => {
    setError(event.error ? event.error.message : '');
    setCardComplete(event.complete);
  };

  return (
    <motion.form 
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <RiInformationLine className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
          <div>
            <p className="text-blue-300 text-sm">
              <strong>Test Mode</strong> - Use these test card details:
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

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Full name
          </label>
          <input
            type="text"
            value={billingDetails.name}
            onChange={(e) => setBillingDetails({ ...billingDetails, name: e.target.value })}
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
            onChange={(e) => setBillingDetails({ ...billingDetails, email: e.target.value })}
            required
            placeholder="jane.doe@example.com"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Card Details
          </label>
          <div className="p-3 bg-gray-700 border border-gray-600 rounded-md">
            <CardElement 
              options={CARD_ELEMENT_OPTIONS} 
              onChange={handleCardChange}
            />
          </div>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-red-900/50 border border-red-700 rounded-md"
        >
          <p className="text-red-300 text-sm">{error}</p>
        </motion.div>
      )}

      <div className="flex items-center text-xs text-gray-400 mb-4">
        <RiLockLine className="h-4 w-4 mr-1" />
        <span>Your payment information is encrypted and secure</span>
      </div>

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
          disabled={!stripe || processing}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex-1 disabled:opacity-50"
        >
          {processing ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Processing...
            </div>
          ) : buttonText}
        </button>
      </div>
    </motion.form>
  );
}