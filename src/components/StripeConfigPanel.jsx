import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiRefreshLine, RiEyeLine, RiEyeOffLine, RiCheckLine, RiAlertLine } from 'react-icons/ri';
import { logSecurityEvent } from '../utils/security';

export default function StripeConfigPanel() {
  const [stripeConfig, setStripeConfig] = useState({
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    testMode: true,
    paymentMethods: {
      card: true,
      sepa: false,
      bacs: false,
      ideal: false
    }
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  useEffect(() => {
    loadStripeConfig();
  }, []);

  const loadStripeConfig = async () => {
    try {
      setIsLoading(true);
      // In a real implementation, fetch from Supabase or API
      // Simulate API call with a delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock data - in production would come from database
      const mockConfig = {
        publishableKey: 'pk_test_51NRLFoEw1FLYKy8hTsUx1GNUX0cUQ3Fgqf4nXJVwxmNILOAF5SaAOaLYMDjfLXQxfUTYMvhUzNFWPTtQW5jXgdHU00Qv5s0uK5',
        secretKey: 'sk_test_••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••',
        webhookSecret: 'whsec_••••••••••••••••••••••••••••••••••••••••••••••••',
        testMode: true,
        paymentMethods: {
          card: true,
          sepa: false,
          bacs: false,
          ideal: false
        }
      };

      setStripeConfig(mockConfig);
      logSecurityEvent('STRIPE_CONFIG_LOADED', { admin: 'platformadmin' });
    } catch (error) {
      console.error('Error loading Stripe configuration:', error);
      setError('Failed to load Stripe configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      // Validate keys
      if (!stripeConfig.publishableKey.startsWith('pk_')) {
        setError('Publishable key must start with "pk_"');
        return;
      }
      
      if (!stripeConfig.secretKey.startsWith('sk_') && !stripeConfig.secretKey.includes('••••')) {
        setError('Secret key must start with "sk_"');
        return;
      }

      // In a real implementation, save to database
      // Simulate API call with a delay
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      logSecurityEvent('STRIPE_CONFIG_UPDATED', { 
        admin: 'platformadmin',
        testMode: stripeConfig.testMode,
        paymentMethods: Object.keys(stripeConfig.paymentMethods).filter(m => stripeConfig.paymentMethods[m]).join(',')
      });
      
      setSuccess('Stripe configuration updated successfully!');
    } catch (error) {
      console.error('Error saving Stripe configuration:', error);
      setError('Failed to save Stripe configuration');
      logSecurityEvent('STRIPE_CONFIG_UPDATE_ERROR', { error: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setStripeConfig(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setStripeConfig(prev => ({
        ...prev,
        [field]: value
      }));
    }

    // Clear messages
    setSuccess('');
    setError('');
  };

  const testConnection = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      
      // Simulate API call with a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock success
      setSuccess('Stripe connection test successful!');
      logSecurityEvent('STRIPE_CONNECTION_TEST_SUCCESS', { admin: 'platformadmin', testMode: stripeConfig.testMode });
    } catch (error) {
      console.error('Error testing Stripe connection:', error);
      setError('Connection test failed. Please check your API keys.');
      logSecurityEvent('STRIPE_CONNECTION_TEST_ERROR', { error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.3 }}
      className="bg-gray-800 rounded-lg p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-white">Stripe API Configuration</h3>
        <button
          onClick={loadStripeConfig}
          disabled={isSaving}
          className="p-2 text-gray-400 hover:text-gray-300 focus:outline-none"
          title="Refresh configuration"
        >
          <RiRefreshLine className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-green-900/20 border border-green-700 rounded-lg"
        >
          <div className="flex items-center">
            <RiCheckLine className="h-5 w-5 text-green-400 mr-2" />
            <p className="text-green-300 text-sm">{success}</p>
          </div>
        </motion.div>
      )}
      
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg"
        >
          <div className="flex items-center">
            <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </motion.div>
      )}

      <div className="space-y-6">
        {/* Environment Selection */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Environment</label>
          <div className="flex items-center space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-primary-600"
                checked={stripeConfig.testMode}
                onChange={() => handleChange('testMode', true)}
              />
              <span className="ml-2 text-gray-300">Test Mode</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-primary-600"
                checked={!stripeConfig.testMode}
                onChange={() => handleChange('testMode', false)}
              />
              <span className="ml-2 text-gray-300">Live Mode</span>
            </label>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            {stripeConfig.testMode 
              ? "Test mode uses Stripe test API keys and won't process real payments."
              : "Live mode processes real payments. Make sure your integration is fully tested."}
          </p>
        </div>

        {/* API Keys */}
        <div>
          <h4 className="text-white font-medium mb-4">API Keys</h4>
          <div className="space-y-4">
            {/* Publishable Key */}
            <div>
              <label htmlFor="publishable-key" className="block text-sm font-medium text-gray-300 mb-1">
                Publishable Key
              </label>
              <input
                id="publishable-key"
                type="text"
                value={stripeConfig.publishableKey}
                onChange={(e) => handleChange('publishableKey', e.target.value)}
                className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder={stripeConfig.testMode ? "pk_test_..." : "pk_live_..."}
              />
            </div>

            {/* Secret Key */}
            <div>
              <label htmlFor="secret-key" className="block text-sm font-medium text-gray-300 mb-1">
                Secret Key
              </label>
              <div className="relative">
                <input
                  id="secret-key"
                  type={showSecretKey ? "text" : "password"}
                  value={stripeConfig.secretKey}
                  onChange={(e) => handleChange('secretKey', e.target.value)}
                  className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm pr-10"
                  placeholder={stripeConfig.testMode ? "sk_test_..." : "sk_live_..."}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                >
                  {showSecretKey ? (
                    <RiEyeOffLine className="h-5 w-5" />
                  ) : (
                    <RiEyeLine className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-yellow-400">
                Warning: Never expose your secret key in client-side code.
              </p>
            </div>

            {/* Webhook Secret */}
            <div>
              <label htmlFor="webhook-secret" className="block text-sm font-medium text-gray-300 mb-1">
                Webhook Secret
              </label>
              <div className="relative">
                <input
                  id="webhook-secret"
                  type={showWebhookSecret ? "text" : "password"}
                  value={stripeConfig.webhookSecret}
                  onChange={(e) => handleChange('webhookSecret', e.target.value)}
                  className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm pr-10"
                  placeholder="whsec_..."
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                >
                  {showWebhookSecret ? (
                    <RiEyeOffLine className="h-5 w-5" />
                  ) : (
                    <RiEyeLine className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div>
          <h4 className="text-white font-medium mb-4">Payment Methods</h4>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-600 bg-gray-700 text-primary-600"
                checked={stripeConfig.paymentMethods.card}
                onChange={(e) => handleChange('paymentMethods.card', e.target.checked)}
              />
              <span className="ml-2 text-gray-300">Credit/Debit Cards</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-600 bg-gray-700 text-primary-600"
                checked={stripeConfig.paymentMethods.sepa}
                onChange={(e) => handleChange('paymentMethods.sepa', e.target.checked)}
              />
              <span className="ml-2 text-gray-300">SEPA Direct Debit</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-600 bg-gray-700 text-primary-600"
                checked={stripeConfig.paymentMethods.bacs}
                onChange={(e) => handleChange('paymentMethods.bacs', e.target.checked)}
              />
              <span className="ml-2 text-gray-300">BACS Direct Debit</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-600 bg-gray-700 text-primary-600"
                checked={stripeConfig.paymentMethods.ideal}
                onChange={(e) => handleChange('paymentMethods.ideal', e.target.checked)}
              />
              <span className="ml-2 text-gray-300">iDEAL</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-700">
          <button
            onClick={testConnection}
            disabled={isSaving || isLoading}
            className="inline-flex justify-center items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}