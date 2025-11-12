import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { RiCustomerServiceLine, RiQuestionLine, RiBookOpenLine, RiMailLine, RiPhoneLine, RiTimeLine, RiSendPlaneLine, RiCheckLine, RiAlertLine, RiLightbulbLine, RiBugLine, RiHeartLine, RiExternalLinkLine, RiChatSmile3Line, RiVideoOnLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';

export default function Support() {
  const [activeTab, setActiveTab] = useState('faq');
  const [contactForm, setContactForm] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    message: '',
    includeSystemInfo: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const { user } = useAuth();
  const { currentPlan, planInfo } = useFeatureAccess();

  const tabs = [
    { id: 'faq', name: 'FAQ', icon: RiQuestionLine }
  ];

  const contactCategories = [
    { value: 'general', label: 'General Question' },
    { value: 'technical', label: 'Technical Issue' },
    { value: 'billing', label: 'Billing & Subscription' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'account', label: 'Account Help' }
  ];

  const priorityLevels = [
    { value: 'low', label: 'Low - General inquiry', color: 'text-blue-400' },
    { value: 'medium', label: 'Medium - Standard support', color: 'text-yellow-400' },
    { value: 'high', label: 'High - Urgent issue', color: 'text-orange-400' },
    { value: 'critical', label: 'Critical - System down', color: 'text-red-400' }
  ];

  const faqData = [
    {
      category: 'Getting Started',
      questions: [
        {
          q: 'How do I add my first inventory item?',
          a: 'Go to the Inventory page and click "Add Item". Fill in the item details like name, category, quantity, and price. You can also use the Receipt Scanner (Professional plan) to automatically add items from receipt photos.'
        },
        {
          q: 'What\'s the difference between Free and Professional plans?',
          a: 'The Free plan includes basic inventory management for up to 100 items. The Professional plan (£9.99/month) includes unlimited items, receipt scanning, Excel imports, VAT reclaim calculations, and priority support.'
        },
        {
          q: 'How do I upgrade to Professional?',
          a: 'Click "Upgrade to Pro" in the sidebar or go to Settings > Subscription. You can upgrade instantly with secure Stripe payment processing.'
        }
      ]
    },
    {
      category: 'Features & Usage',
      questions: [
        {
          q: 'How does the Receipt Scanner work?',
          a: 'Upload a photo of your receipt, select the items you want to add, and our OCR technology will extract item names, prices, and quantities automatically. This feature requires a Professional plan.'
        },
        {
          q: 'Can I import data from Excel?',
          a: 'Yes! With the Professional plan, you can import inventory data from Excel files. The system supports standard formats and will guide you through the mapping process.'
        },
        {
          q: 'How are VAT reclaims calculated?',
          a: 'The system calculates VAT reclaims from VAT-inclusive purchase prices using the formula: VAT Amount = (Purchase Price × VAT Rate) ÷ (100 + VAT Rate). This helps you claim back VAT from HMRC if you\'re VAT registered.'
        }
      ]
    },
    {
      category: 'Account & Billing',
      questions: [
        {
          q: 'How do I cancel my subscription?',
          a: 'Go to Settings > Subscription and click "Cancel Subscription". Your access will continue until the end of your current billing period, then you\'ll be moved to the Free plan.'
        },
        {
          q: 'Is my data secure?',
          a: 'Yes! We use enterprise-grade security with encrypted data storage, secure authentication, and regular backups. Your data is never shared with third parties.'
        }
      ]
    }
  ];

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In a real app, this would send to your support system
      const supportTicket = {
        id: `TRACK-${Date.now()}`,
        user: user?.email,
        businessName: user?.businessName,
        plan: currentPlan,
        timestamp: new Date().toISOString(),
        ...contactForm,
        systemInfo: contactForm.includeSystemInfo ? {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        } : null
      };

      console.log('Support ticket submitted:', supportTicket);

      setSubmitStatus({
        type: 'success',
        message: `Support ticket ${supportTicket.id} created successfully! We'll respond within 24 hours.`
      });

      // Reset form
      setContactForm({
        subject: '',
        category: 'general',
        priority: 'medium',
        message: '',
        includeSystemInfo: true
      });

    } catch (error) {
      console.error('Error submitting support ticket:', error);
      setSubmitStatus({
        type: 'error',
        message: 'Failed to submit support ticket. Please try again or email us directly.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSystemInfo = () => {
    return {
      browser: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      plan: currentPlan,
      user: user?.email
    };
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-white">Support Center</h1>
            <p className="mt-2 text-sm text-gray-400">
              Get help with Trackio inventory management system
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm text-gray-400">Current Plan</div>
              <div className={`text-sm font-medium ${
                currentPlan === 'professional' 
                  ? 'text-green-400' 
                  : 'text-gray-300'
              }`}>
                {planInfo?.name || 'Free Plan'}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Contact Options */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-gray-800 rounded-lg p-6 text-center max-w-md mx-auto"
          >
            <RiMailLine className="h-12 w-12 text-primary-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Email Support</h3>
            <p className="text-gray-400 text-sm mb-4">
              Get help via email. We'll respond as soon as possible.
            </p>
            <a
              href="mailto:support@trackio.com"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
            >
              <RiMailLine className="h-4 w-4 mr-2" />
              support@trackio.com
            </a>
          </motion.div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'faq' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {faqData.map((category, categoryIndex) => (
                <div key={categoryIndex} className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-white mb-6">{category.category}</h3>
                  <div className="space-y-4">
                    {category.questions.map((item, itemIndex) => (
                      <details key={itemIndex} className="group">
                        <summary className="flex justify-between items-center cursor-pointer p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                          <span className="text-white font-medium">{item.q}</span>
                          <RiQuestionLine className="h-5 w-5 text-gray-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                          <p className="text-gray-300">{item.a}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Bottom Help Section */}
        <div className="mt-12 bg-gradient-to-r from-primary-600/20 to-blue-600/20 rounded-lg p-6 border border-primary-500/30">
          <div className="flex items-start">
            <RiHeartLine className="h-6 w-6 text-primary-400 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-2">Need More Help?</h3>
              <p className="text-gray-300 text-sm mb-4">
                Our support team is here to help you get the most out of Trackio. Don't hesitate to reach out with any questions or feedback.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="mailto:support@trackio.com"
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                >
                  <RiMailLine className="h-4 w-4 mr-2" />
                  Email Support
                </a>
                <button
                  onClick={() => setActiveTab('faq')}
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  <RiQuestionLine className="h-4 w-4 mr-2" />
                  Browse FAQ
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}