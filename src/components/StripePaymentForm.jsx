import {useState} from 'react';
import {motion} from 'framer-motion';
import {RiSecurePaymentLine, RiCheckLine, RiAlertLine} from 'react-icons/ri';
import {useAuth} from '../context/AuthContext';
import {useNavigate} from 'react-router-dom';
import {supabase} from '../lib/supabase';
import {logSecurityEvent} from '../utils/security';

export default function StripePaymentForm({plan, onSuccess, onCancel}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const {user} = useAuth();
  const navigate = useNavigate();

  const handlePayment = async () => {
    if (!user?.email || !plan) return;

    try {
      setIsProcessing(true);
      setError('');

      logSecurityEvent('PAYMENT_INITIATED', {
        planId: plan.id,
        userEmail: user.email,
        amount: plan.price
      });

      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update subscription in Supabase
      if (supabase) {
        // Check if user already has a subscription
        const {data: existingSubscription, error: fetchError} = await supabase
          .from('subscriptions_tb2k4x9p1m')
          .select('*')
          .eq('user_email', user.email.toLowerCase())
          .single();

        const subscriptionData = {
          user_email: user.email.toLowerCase(),
          stripe_customer_id: `cus_${Math.random().toString(36).substring(2, 15)}`,
          stripe_subscription_id: `sub_${Math.random().toString(36).substring(2, 15)}`,
          plan_id: `price_${plan.id}`,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        };

        if (existingSubscription && !fetchError) {
          // Update existing subscription
          const {error: updateError} = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .update(subscriptionData)
            .eq('user_email', user.email.toLowerCase());

          if (updateError) throw updateError;
        } else {
          // Create new subscription
          subscriptionData.created_at = new Date().toISOString();
          const {error: insertError} = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .insert([subscriptionData]);

          if (insertError) throw insertError;
        }
      }

      logSecurityEvent('PAYMENT_SUCCESS', {
        planId: plan.id,
        userEmail: user.email
      });

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Navigate to success page
      navigate('/payment-success?plan=' + plan.id);

    } catch (error) {
      console.error('Payment processing error:', error);
      setError('Payment failed. Please try again.');
      
      logSecurityEvent('PAYMENT_FAILED', {
        planId: plan.id,
        userEmail: user.email,
        error: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      className="bg-gray-800 rounded-lg p-6 shadow-xl"
    >
      <div className="text-center mb-6">
        <RiSecurePaymentLine className="h-12 w-12 text-primary-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white">Complete Your Upgrade</h3>
        <p className="text-gray-400 text-sm mt-1">
          Upgrade to {plan.name} Plan
        </p>
      </div>

      {/* Plan Summary */}
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

      {/* Simulated Payment Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Card Number (Demo)
          </label>
          <input
            type="text"
            value="4242 4242 4242 4242"
            readOnly
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Expiry
            </label>
            <input
              type="text"
              value="12/25"
              readOnly
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              CVC
            </label>
            <input
              type="text"
              value="123"
              readOnly
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            />
          </div>
        </div>
      </div>

      {/* Demo Notice */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-6">
        <p className="text-blue-300 text-sm text-center">
          <strong>Demo Mode:</strong> This is a simulated payment. Your subscription will be activated immediately.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{opacity: 0, y: -10}}
          animate={{opacity: 1, y: 0}}
          className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg"
        >
          <div className="flex items-center">
            <RiAlertLine className="h-4 w-4 text-red-400 mr-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
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
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </div>
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