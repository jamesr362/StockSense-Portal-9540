import { motion } from 'framer-motion';
import { useState } from 'react';
import { RiUser3Line, RiMoneyDollarCircleLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import SubscriptionManagement from './SubscriptionManagement';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const { user } = useAuth();

  const tabs = [
    { id: 'general', name: 'General', icon: RiUser3Line },
    { id: 'subscription', name: 'Subscription', icon: RiMoneyDollarCircleLine },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-full w-full"
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 mb-8">
          <div className="sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <h1 className="text-2xl font-semibold text-white">Settings</h1>
              <p className="mt-2 text-sm text-gray-400">
                Manage your account preferences and configuration
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 mb-8">
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

        {/* Content */}
        <div className="flex-1 min-h-0 w-full">
          {activeTab === 'general' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <div className="bg-gray-800 rounded-lg p-6 w-full">
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
                        readOnly
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
                        readOnly
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-primary-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'subscription' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <SubscriptionManagement />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}