import {useState,useEffect} from 'react';
import {motion} from 'framer-motion';
import {RiDownloadLine,RiEyeLine,RiCalendarLine} from 'react-icons/ri';
import {formatPrice} from '../lib/stripe';

export default function BillingHistory({customerId}) {
  const [billingHistory,setBillingHistory]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState('all');

  useEffect(()=> {
    if (customerId) {
      loadBillingHistory();
    }
  },[customerId]);

  const loadBillingHistory=async ()=> {
    try {
      setLoading(true);
      // Simulate API call with a delay
      await new Promise(resolve=> setTimeout(resolve,800));

      // Mock billing history - replace with actual Stripe API call
      const mockHistory=[ 
        {
          id: 'in_1234567890',
          date: '2024-01-15',
          description: 'Professional Plan - Monthly',
          amount: 35.00,
          status: 'paid',
          invoice_pdf: 'https://pay.stripe.com/invoice/...',
          period_start: '2024-01-15',
          period_end: '2024-02-15'
        },
        {
          id: 'in_0987654321',
          date: '2023-12-15',
          description: 'Professional Plan - Monthly',
          amount: 35.00,
          status: 'paid',
          invoice_pdf: 'https://pay.stripe.com/invoice/...',
          period_start: '2023-12-15',
          period_end: '2024-01-15'
        },
        {
          id: 'in_1122334455',
          date: '2023-11-15',
          description: 'Basic Plan - Monthly',
          amount: 15.00,
          status: 'paid',
          invoice_pdf: 'https://pay.stripe.com/invoice/...',
          period_start: '2023-11-15',
          period_end: '2023-12-15'
        }
      ];

      setBillingHistory(mockHistory);
    } catch (error) {
      console.error('Error loading billing history:',error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory=billingHistory.filter(invoice=> {
    if (filter==='all') return true;
    return invoice.status===filter;
  });

  const getStatusColor=(status)=> {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate=(dateString)=> {
    return new Date(dateString).toLocaleDateString('en-GB',{
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
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
            <h3 className="text-lg leading-6 font-medium text-white">Billing History</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              View and download your invoices and payment history
            </p>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex space-x-2">
          {['all','paid','pending','failed'].map((status)=> (
            <button
              key={status}
              onClick={()=> setFilter(status)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter===status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 sm:p-6">
        {filteredHistory.length===0 ? (
          <div className="text-center py-8">
            <RiCalendarLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No billing history</h3>
            <p className="text-gray-400">
              {filter==='all'
                ? 'Your billing history will appear here once you have transactions'
                : `No ${filter} transactions found`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((invoice)=> (
              <motion.div
                key={invoice.id}
                initial={{opacity: 0,y: 10}}
                animate={{opacity: 1,y: 0}}
                className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-medium">{invoice.description}</h4>
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(
                          invoice.status
                        )}`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-400">
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <span className="text-white ml-1">{formatDate(invoice.date)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <span className="text-white ml-1">{formatPrice(invoice.amount)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Period:</span>
                        <span className="text-white ml-1">
                          {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={()=> window.open(invoice.invoice_pdf,'_blank')}
                      className="text-gray-400 hover:text-gray-300 p-2 rounded-md hover:bg-gray-700"
                      title="View invoice"
                    >
                      <RiEyeLine className="h-4 w-4" />
                    </button>
                    <button
                      onClick={()=> window.open(invoice.invoice_pdf,'_blank')}
                      className="text-gray-400 hover:text-gray-300 p-2 rounded-md hover:bg-gray-700"
                      title="Download invoice"
                    >
                      <RiDownloadLine className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}