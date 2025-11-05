import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { RiCustomerServiceLine, RiQuestionLine, RiBookOpenLine, RiMailLine, RiPhoneLine, RiTimeLine, RiSendPlaneLine, RiCheckLine, RiAlertLine, RiLightbulbLine, RiBugLine, RiHeartLine, RiExternalLinkLine, RiChatSmile3Line, RiVideoOnLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';

export default function Support() {
  const [activeTab, setActiveTab] = useState('contact');
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
    { id: 'contact', name: 'Contact Us', icon: RiMailLine },
    { id: 'faq', name: 'FAQ', icon: RiQuestionLine },
    { id: 'guides', name: 'User Guides', icon: RiBookOpenLine },
    { id: 'status', name: 'System Status', icon: RiTimeLine }
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
          a: 'The Free plan includes basic inventory management for up to 50 items. The Professional plan (£9.99/month) includes unlimited items, receipt scanning, Excel imports, VAT refund calculations, and priority support.'
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
          q: 'How are VAT refunds calculated?',
          a: 'The system calculates VAT refunds from VAT-inclusive purchase prices using the formula: VAT Amount = (Purchase Price × VAT Rate) ÷ (100 + VAT Rate). This helps you claim back VAT from HMRC if you\'re VAT registered.'
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
          q: 'Do you offer refunds?',
          a: 'We offer a 30-day money-back guarantee for new Professional subscriptions. Contact support if you\'re not satisfied within your first 30 days.'
        },
        {
          q: 'Is my data secure?',
          a: 'Yes! We use enterprise-grade security with encrypted data storage, secure authentication, and regular backups. Your data is never shared with third parties.'
        }
      ]
    },
    {
      category: 'Technical Support',
      questions: [
        {
          q: 'The app is running slowly. What can I do?',
          a: 'Try refreshing your browser, clearing your cache, or using a different browser. If issues persist, contact support with your browser and device information.'
        },
        {
          q: 'I can\'t log in to my account',
          a: 'Try resetting your password using the "Forgot Password" link on the login page. If you still can\'t access your account, contact support with your email address.'
        },
        {
          q: 'Can I export my data?',
          a: 'Yes! You can export your inventory data in multiple formats (Excel, CSV, PDF) from the Tax Exports page. This ensures you always have access to your data.'
        }
      ]
    }
  ];

  const userGuides = [
    {
      title: 'Getting Started with Trackio',
      description: 'Complete guide to setting up your inventory system',
      icon: RiLightbulbLine,
      topics: ['Account setup', 'Adding your first items', 'Understanding the dashboard', 'Plan selection'],
      estimatedTime: '10 minutes'
    },
    {
      title: 'Receipt Scanner Guide',
      description: 'How to use OCR technology to scan receipts automatically',
      icon: RiChatSmile3Line,
      topics: ['Taking good photos', 'Selecting items', 'Editing extracted data', 'Bulk processing'],
      estimatedTime: '5 minutes',
      requiresPro: true
    },
    {
      title: 'VAT Refund Calculator',
      description: 'Calculate and export VAT refunds for HMRC submissions',
      icon: RiBookOpenLine,
      topics: ['VAT registration requirements', 'Generating reports', 'Understanding calculations', 'HMRC compliance'],
      estimatedTime: '15 minutes',
      requiresPro: true
    },
    {
      title: 'Excel Import & Export',
      description: 'Import existing data and export reports',
      icon: RiVideoOnLine,
      topics: ['Preparing Excel files', 'Data mapping', 'Export formats', 'Troubleshooting'],
      estimatedTime: '8 minutes',
      requiresPro: true
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
          {activeTab === 'contact' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl"
            >
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-6">Contact Support</h3>
                
                {submitStatus && (
                  <div className={`mb-6 p-4 rounded-lg ${
                    submitStatus.type === 'success' 
                      ? 'bg-green-900/50 border border-green-700' 
                      : 'bg-red-900/50 border border-red-700'
                  }`}>
                    <div className="flex items-center">
                      {submitStatus.type === 'success' ? (
                        <RiCheckLine className="h-5 w-5 text-green-400 mr-2" />
                      ) : (
                        <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
                      )}
                      <p className={`text-sm ${
                        submitStatus.type === 'success' ? 'text-green-300' : 'text-red-300'
                      }`}>
                        {submitStatus.message}
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      required
                      value={contactForm.subject}
                      onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Brief description of your issue"
                      className="w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Category
                      </label>
                      <select
                        value={contactForm.category}
                        onChange={(e) => setContactForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      >
                        {contactCategories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Priority
                      </label>
                      <select
                        value={contactForm.priority}
                        onChange={(e) => setContactForm(prev => ({ ...prev, priority: e.target.value }))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      >
                        {priorityLevels.map(level => (
                          <option key={level.value} value={level.value}>{level.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Message *
                    </label>
                    <textarea
                      required
                      rows={6}
                      value={contactForm.message}
                      onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, or specific questions."
                      className="w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="systemInfo"
                      checked={contactForm.includeSystemInfo}
                      onChange={(e) => setContactForm(prev => ({ ...prev, includeSystemInfo: e.target.checked }))}
                      className="mt-1 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="systemInfo" className="ml-2 text-sm text-gray-300">
                      Include system information (browser, URL, account details) to help us troubleshoot faster
                    </label>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-2">Your Account Information</h4>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>Email: {user?.email}</div>
                      <div>Business: {user?.businessName || 'Not set'}</div>
                      <div>Plan: {planInfo?.name || 'Free Plan'}</div>
                      <div>User ID: {user?.id || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <RiSendPlaneLine className="h-4 w-4 mr-2" />
                          Submit Support Request
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

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

          {activeTab === 'guides' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {userGuides.map((guide, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <guide.icon className="h-8 w-8 text-primary-400 mt-1" />
                    {guide.requiresPro && currentPlan !== 'professional' && (
                      <span className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 rounded">
                        Pro Only
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">{guide.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{guide.description}</p>
                  
                  <div className="mb-4">
                    <h4 className="text-white font-medium text-sm mb-2">Topics covered:</h4>
                    <ul className="text-gray-300 text-sm space-y-1">
                      {guide.topics.map((topic, topicIndex) => (
                        <li key={topicIndex} className="flex items-center">
                          <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mr-2"></div>
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-gray-400 text-sm">
                      <RiTimeLine className="h-4 w-4 mr-1" />
                      {guide.estimatedTime}
                    </div>
                    <button 
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        guide.requiresPro && currentPlan !== 'professional'
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      }`}
                      disabled={guide.requiresPro && currentPlan !== 'professional'}
                    >
                      <RiExternalLinkLine className="h-4 w-4 mr-2" />
                      {guide.requiresPro && currentPlan !== 'professional' ? 'Upgrade Required' : 'View Guide'}
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'status' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-white">System Status</h3>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
                    <span className="text-green-400 text-sm font-medium">All Systems Operational</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { service: 'Web Application', status: 'operational', uptime: '99.9%' },
                    { service: 'Database', status: 'operational', uptime: '99.8%' },
                    { service: 'Receipt Scanner', status: 'operational', uptime: '99.7%' },
                    { service: 'File Storage', status: 'operational', uptime: '99.9%' },
                    { service: 'Payment Processing', status: 'operational', uptime: '100%' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${
                          item.status === 'operational' ? 'bg-green-400' : 'bg-red-400'
                        }`}></div>
                        <span className="text-white font-medium">{item.service}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 text-sm font-medium capitalize">{item.status}</div>
                        <div className="text-gray-400 text-xs">{item.uptime} uptime</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-4">Recent Updates</h3>
                <div className="space-y-4">
                  {[
                    {
                      date: '2024-01-15',
                      title: 'Enhanced Receipt Scanner',
                      description: 'Improved OCR accuracy and faster processing times',
                      type: 'improvement'
                    },
                    {
                      date: '2024-01-10',
                      title: 'Mobile Responsiveness Update',
                      description: 'Better mobile experience for inventory management',
                      type: 'improvement'
                    },
                    {
                      date: '2024-01-05',
                      title: 'Security Enhancement',
                      description: 'Updated authentication and data encryption',
                      type: 'security'
                    }
                  ].map((update, index) => (
                    <div key={index} className="flex items-start p-4 bg-gray-700 rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 mr-3 ${
                        update.type === 'improvement' ? 'bg-blue-400' : 
                        update.type === 'security' ? 'bg-green-400' : 'bg-yellow-400'
                      }`}></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-white font-medium">{update.title}</h4>
                          <span className="text-gray-400 text-sm">{update.date}</span>
                        </div>
                        <p className="text-gray-300 text-sm">{update.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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