import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiMoneyDollarCircleLine, RiAddLine, RiDeleteBin6Line, RiCheckLine, RiEditLine } from 'react-icons/ri';
import { logSecurityEvent } from '../utils/security';

export default function PaymentMethodManager({ customerId, onPaymentMethodChange }) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadPaymentMethods();
    }
  }, [customerId]);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock payment methods data
      const mockMethods = [
        {
          id: 'pm_demo1',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025,
          },
          is_default: true,
        },
        {
          id: 'pm_demo2',
          card: {
            brand: 'mastercard',
            last4: '5555',
            exp_month: 8,
            exp_year: 2026,
          },
          is_default: false,
        }
      ];
      
      setPaymentMethods(mockMethods);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async (cardData) => {
    try {
      // Mock adding a payment method
      const newMethod = {
        id: `pm_${Date.now()}`,
        card: {
          brand: cardData.brand || 'visa',
          last4: cardData.last4 || '0000',
          exp_month: cardData.exp_month || 12,
          exp_year: cardData.exp_year || 2025,
        },
        is_default: paymentMethods.length === 0,
      };
      
      setPaymentMethods([...paymentMethods, newMethod]);
      setShowAddForm(false);
      
      logSecurityEvent('PAYMENT_METHOD_ADDED', {
        paymentMethodId: newMethod.id
      });
      
      if (onPaymentMethodChange) {
        onPaymentMethodChange(newMethod);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetDefault = async (paymentMethodId) => {
    try {
      setActionLoading(true);
      
      // Update default payment method
      const updatedMethods = paymentMethods.map(pm => ({
        ...pm,
        is_default: pm.id === paymentMethodId
      }));
      
      setPaymentMethods(updatedMethods);
      
      logSecurityEvent('PAYMENT_METHOD_SET_DEFAULT', {
        paymentMethodId
      });
      
      if (onPaymentMethodChange) {
        onPaymentMethodChange(updatedMethods.find(pm => pm.is_default));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePaymentMethod = async (paymentMethodId) => {
    if (!window.confirm('Are you sure you want to delete this payment method?')) {
      return;
    }
    
    try {
      setActionLoading(true);
      
      const updatedMethods = paymentMethods.filter(pm => pm.id !== paymentMethodId);
      
      // If we deleted the default method, make the first remaining method default
      if (updatedMethods.length > 0) {
        const deletedWasDefault = paymentMethods.find(pm => pm.id === paymentMethodId)?.is_default;
        if (deletedWasDefault) {
          updatedMethods[0].is_default = true;
        }
      }
      
      setPaymentMethods(updatedMethods);
      
      logSecurityEvent('PAYMENT_METHOD_DELETED', {
        paymentMethodId
      });
      
      if (onPaymentMethodChange) {
        onPaymentMethodChange(updatedMethods.find(pm => pm.is_default) || null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getCardBrandIcon = (brand) => {
    // Simple card brand icons
    const brandMap = {
      visa: '💳',
      mastercard: '💳',
      amex: '💳',
      discover: '💳',
    };
    
    return brandMap[brand] || '💳';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg">
      <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg leading-6 font-medium text-white">Payment Methods</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Manage your payment methods and billing information
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RiAddLine className="h-4 w-4 mr-2" />
            Add Payment Method
          </button>
        </div>
      </div>
      <div className="px-4 py-5 sm:p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
        
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-gray-700 rounded-lg border border-gray-600"
            >
              <h4 className="text-white font-medium mb-4">Add New Payment Method</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      CVC
                    </label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddPaymentMethod({ brand: 'visa', last4: '1234' })}
                    className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Add Payment Method
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <RiMoneyDollarCircleLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No payment methods</h3>
            <p className="text-gray-400 mb-4">Add a payment method to manage your subscription</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <RiAddLine className="h-4 w-4 mr-2" />
              Add Your First Payment Method
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <motion.div
                key={method.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600"
              >
                <div className="flex items-center">
                  <div className="text-2xl mr-3">
                    {getCardBrandIcon(method.card.brand)}
                  </div>
                  <div>
                    <div className="flex items-center">
                      <span className="text-white font-medium">
                        •••• •••• •••• {method.card.last4}
                      </span>
                      {method.is_default && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <RiCheckLine className="h-3 w-3 mr-1" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">
                      {method.card.brand.toUpperCase()} expires {method.card.exp_month}/{method.card.exp_year}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!method.is_default && (
                    <button
                      onClick={() => handleSetDefault(method.id)}
                      disabled={actionLoading}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors disabled:opacity-50"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeletePaymentMethod(method.id)}
                    disabled={actionLoading || (paymentMethods.length === 1)}
                    className="p-2 text-red-400 hover:text-red-300 rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
                    title={paymentMethods.length === 1 ? "Cannot delete last payment method" : "Delete payment method"}
                  >
                    <RiDeleteBin6Line className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <div className="flex items-start">
            <RiMoneyDollarCircleLine className="h-5 w-5 text-blue-400 mr-3 mt-0.5" />
            <div>
              <h4 className="text-blue-400 font-medium mb-1">Secure Payment Processing</h4>
              <p className="text-blue-300 text-sm">
                Your payment information is encrypted and securely processed. We never store your complete card details on our servers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}