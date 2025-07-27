import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiDownloadLine, RiEyeLine, RiCalendarLine, RiMoneyDollarCircleLine } from 'react-icons/ri';
import { formatPrice } from '../lib/stripe';

export default function BillingHistory({ customerId }) {
  const [billingHistory, setBillingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (customerId) {
      loadBillingHistory();
    }
  }, [customerId]);

  const loadBillingHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock billing history data
      const mockHistory = [
        {
          id: 'in_demo1',
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          amount: 1200,
          currency: 'gbp',
          status: 'paid',
          plan: 'Professional Plan',
          period: 'Jan 1 - Jan 31, 2024',
          invoice_pdf: '/invoices/demo1.pdf'
        },
        {
          id: 'in_demo2',
          date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          amount: 1200,
          currency: 'gbp',
          status: 'paid',
          plan: 'Professional Plan',
          period: 'Dec 1 - Dec 31, 2023',
          invoice_pdf: '/invoices/demo2.pdf'
        },
        {
          id: 'in_demo3',
          date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          amount: 1200,
          currency: 'gbp',
          status: 'paid',
          plan: 'Professional Plan',
          period: 'Nov 1 - Nov 30, 2023',
          invoice_pdf: '/invoices/demo3.pdf'
        }
      ];

      setBillingHistory(mockHistory);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = (invoice) => {
    // Mock download functionality
    console.log('Downloading invoice:', invoice.id);
    
    // Create a mock invoice file
    const invoiceContent = `
Invoice ${invoice.id}
Date: ${invoice.date.toLocaleDateString()}
Plan: ${invoice.plan}
Period: ${invoice.period}
Amount: ${formatPrice(invoice.amount / 100)}
Status: ${invoice.status}
`;

    const blob = new Blob([invoiceContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${invoice.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
        <h3 className="text-lg leading-6 font-medium text-white">Billing History</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Your recent invoices and payment history
        </p>
      </div>
      <div className="px-4 py-5 sm:p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
        
        {billingHistory.length === 0 ? (
          <div className="text-center py-8">
            <RiMoneyDollarCircleLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No billing history</h3>
            <p className="text-gray-400">Your invoices will appear here once you have an active subscription.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {billingHistory.map((invoice) => (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <RiCalendarLine className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-white font-medium">
                        {invoice.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                      <span className={`ml-3 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      <p>{invoice.plan} - {invoice.period}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">
                        {formatPrice(invoice.amount / 100)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {invoice.currency.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownloadInvoice(invoice)}
                        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                        title="Download Invoice"
                      >
                        <RiDownloadLine className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadInvoice(invoice)}
                        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                        title="View Invoice"
                      >
                        <RiEyeLine className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Need help with billing? Contact our support team at{' '}
            <a href="mailto:billing@trackio.com" className="text-primary-400 hover:text-primary-300">
              billing@trackio.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}