import {motion} from 'framer-motion';
import {useState} from 'react';
import {RiNotification3Line, RiUser3Line, RiLockLine, RiStore2Line, RiPriceTag3Line} from 'react-icons/ri';
import {useAuth} from '../context/AuthContext';
import SecurityAuditLog from '../components/SecurityAuditLog';
import SubscriptionManager from '../components/SubscriptionManager';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const {user} = useAuth();

  const tabs = [
    {id: 'general', name: 'General', icon: RiStore2Line},
    {id: 'notifications', name: 'Notifications', icon: RiNotification3Line},
    {id: 'security', name: 'Security', icon: RiLockLine},
    {id: 'billing', name: 'Subscription & Billing', icon: RiPriceTag3Line},
    {id: 'team', name: 'Team', icon: RiUser3Line},
  ];

  return (
    <div>
      <motion.div
        initial={{opacity: 0, y: 20}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.5}}
      >
        <div className="sm:flex sm:items-center mb-8">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-white">Settings</h1>
            <p className="mt-2 text-sm text-gray-400">
              Manage your account preferences and configuration
            </p>
          </div>
        </div>

        <div className="mt-8">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
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

          <div className="mt-8">
            {activeTab === 'general' && (
              <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{duration: 0.3}}
                className="space-y-6"
              >
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-medium leading-6 text-white mb-6">
                    Business Information
                  </h3>
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="business-name" className="block text-sm font-medium text-gray-300">
                        Business Name
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="business-name"
                          id="business-name"
                          value={user?.businessName || ''}
                          className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                        Email
                      </label>
                      <div className="mt-1">
                        <input
                          type="email"
                          name="email"
                          id="email"
                          value={user?.email || ''}
                          className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-5">
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-primary-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{duration: 0.3}}
                className="space-y-6"
              >
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-white mb-6">
                    Notification Preferences
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="email-notifications"
                          name="email-notifications"
                          type="checkbox"
                          className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="email-notifications" className="font-medium text-white">
                          Email Notifications
                        </label>
                        <p className="text-gray-400">
                          Get notified about low stock, new orders, and important updates.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="low-stock-alerts"
                          name="low-stock-alerts"
                          type="checkbox"
                          className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="low-stock-alerts" className="font-medium text-white">
                          Low Stock Alerts
                        </label>
                        <p className="text-gray-400">
                          Receive alerts when inventory items are running low.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{duration: 0.3}}
                className="space-y-6"
              >
                <SecurityAuditLog userEmail={user?.email} />
              </motion.div>
            )}

            {activeTab === 'billing' && (
              <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{duration: 0.3}}
                className="space-y-6"
              >
                <SubscriptionManager
                  customerId="cus_mock123"
                  onSubscriptionChange={(data) => console.log('Subscription changed:', data)}
                />
              </motion.div>
            )}

            {activeTab === 'team' && (
              <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{duration: 0.3}}
                className="space-y-6"
              >
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-white mb-6">
                    Team Management
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Team management features are coming soon. You'll be able to invite team members and manage their permissions.
                  </p>
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                    <p className="text-blue-300 text-sm">
                      <strong>Current Plan:</strong> {user?.subscriptionPlan || 'Free'} Plan - Supports up to{' '}
                      {user?.subscriptionPlan === 'power' 
                        ? 'unlimited' 
                        : user?.subscriptionPlan === 'pro' 
                        ? '3' 
                        : '1'
                      } team members
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}