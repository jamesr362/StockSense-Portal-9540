// src/components/StripePaymentForm.js
import { useState } from 'react';
import { motion } from 'framer-motion';
import { RiSecurePaymentLine, RiCheckLine, RiAlertLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

export default function StripePaymentForm({ plan, onSuccess, onCancel }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handlePayment = async () => {
    if (!user?.email || !plan?.id) {
      setError('Missing user or plan information');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');

      logSecurityEvent('PAYMENT_INITIATED', {
        planId: plan.id,
        userEmail: user.email,
      });

      // Create a Stripe Checkout Session via Netlify
      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.id,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);

      window.location.href = url; // redirect to Stripe checkout
    } catch (err) {
      console.error('Payment processing error:', err);
      setError('Payment failed. Please try again.');
      logSecurityEvent('PAYMENT_FAILED', {
        planId: plan.id,
        userEmail: user.email,
        error: err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-lg p-6 shadow-xl"
    >
      <div className="text-center mb-6">
        <RiSecurePaymentLine className="h-12 w-12 text-primary-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white">Complete Your Upgrade</h3>
        <p className="text-gray-400 text-sm mt-1">
          Upgrade to {plan.name} Plan
        </p>
      </div>

      <div className="bg-gray-700 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white font-medium">{plan.name} Plan</span>
          <span className="text-primary-400 font-bold text-lg">
            £{plan.price}/month
          </span>
        </div>
        <div className="text-gray-300 text-sm">
          <p>• {plan.features.slice(0, 3).join(' • ')}</p>
          {plan.features.length > 3 && (
            <p className="mt-1">• And {plan.features.length - 3} more features</p>
          )}
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg"
        >
          <div className="flex items-center">
            <RiAlertLine className="h-4 w-4 text-red-400 mr-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </motion.div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              <RiCheckLine className="h-4 w-4 mr-2" />
              Pay £{plan.price}/month
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
