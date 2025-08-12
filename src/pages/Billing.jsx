import {motion} from 'framer-motion';
import {useState,useEffect} from 'react';
import {RiCreditCardLine,RiCalendarLine,RiLineChartLine,RiSettings3Line,RiArrowUpLine} from 'react-icons/ri';
import {useAuth} from '../context/AuthContext';
import SubscriptionManager from '../components/SubscriptionManager';
import BillingHistory from '../components/BillingHistory';
import UsageMetrics from '../components/UsageMetrics';
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import {SUBSCRIPTION_PLANS} from '../lib/stripe';

export default function Billing() {
  const [activeTab,setActiveTab]=useState('overview');
  const [showUpgradeModal,setShowUpgradeModal]=useState(false);
  const [currentPlan,setCurrentPlan]=useState('professional');
  const {user}=useAuth();

  const tabs=[ 
    {id: 'overview',name: 'Overview',icon: RiLineChartLine},
    {id: 'subscription',name: 'Subscription',icon: RiCreditCardLine},
    {id: 'usage',name: 'Usage',icon: RiLineChartLine},
    {id: 'history',name: 'Billing History',icon: RiCalendarLine},
    {id: 'settings',name: 'Settings',icon: RiSettings3Line} 
  ];

  const handlePlanUpgrade=async (plan,billingInterval)=> {
    try {
      // In a real app,this would call your Stripe API
      console.log('Upgrading to:',plan.name,billingInterval);
      // Simulate API call 
      await new Promise(resolve=> setTimeout(resolve,2000));
      setCurrentPlan(plan.id);
      setShowUpgradeModal(false);
      // Show success message
      alert(`Successfully upgraded to ${plan.name}!`);
    } catch (error) {
      console.error('Upgrade failed:',error);
      alert('Failed to upgrade. Please try again later.');
    }
  };

  const currentPlanDetails=SUBSCRIPTION_PLANS[currentPlan];

  return (
    <div>
      <motion.div
        initial={{opacity: 0,y: 20}}
        animate={{opacity: 1,y: 0}}
        transition={{duration: 0.5}}
      >
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-white">Billing & Subscription</h1>
            <p className="mt-2 text-sm text-gray-400">
              Manage your subscription,billing,and usage
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={()=> setShowUpgradeModal(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <RiArrowUpLine className="h-4 w-4 mr-2" />
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab)=> (
                <button
                  key={tab.id}
                  onClick={()=> setActiveTab(tab.id)}
                  className={`flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab===tab.id
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
          {activeTab==='overview' && (
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{duration: 0.3}}
              className="space-y-6"
            >
              {/* Current Plan Overview */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">Current Plan</h3>
                  <button
                    onClick={()=> setShowUpgradeModal(true)}
                    className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                  >
                    Upgrade Plan
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="col-span-1">
                    <div className="text-center p-4 bg-gray-700 rounded-lg">
                      <h4 className="text-xl font-bold text-white mb-2">
                        {currentPlanDetails?.name || 'Professional'}
                      </h4>
                      <p className="text-3xl font-bold text-primary-400">
                        £{currentPlanDetails?.price || 35}
                      </p>
                      <p className="text-gray-400 text-sm">per month</p>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <h5 className="text-white font-medium mb-3">Plan Features</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(currentPlanDetails?.features || []).slice(0,6).map((feature,index)=> (
                        <div key={index} className="flex items-start text-sm">
                          <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                          <span className="text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg">
                  <div className="flex items-center">
                    <RiCalendarLine className="h-8 w-8 text-blue-400 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-white">Jan 15</div>
                      <div className="text-gray-400 text-sm">Next Billing Date</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg">
                  <div className="flex items-center">
                    <RiCreditCardLine className="h-8 w-8 text-green-400 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-white">£35.00</div>
                      <div className="text-gray-400 text-sm">Monthly Cost</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg">
                  <div className="flex items-center">
                    <RiLineChartLine className="h-8 w-8 text-purple-400 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-white">247</div>
                      <div className="text-gray-400 text-sm">Items Tracked</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab==='subscription' && (
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{duration: 0.3}}
            >
              <SubscriptionManager
                customerId={user?.email}
                onSubscriptionChange={()=> {
                  // Refresh data
                  console.log('Subscription changed');
                }}
              />
            </motion.div>
          )}

          {activeTab==='usage' && (
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{duration: 0.3}}
            >
              <UsageMetrics userPlan={currentPlan} />
            </motion.div>
          )}

          {activeTab==='history' && (
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{duration: 0.3}}
            >
              <BillingHistory customerId={user?.email} />
            </motion.div>
          )}

          {activeTab==='settings' && (
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{duration: 0.3}}
              className="space-y-6"
            >
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-4">Billing Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Auto-renewal</h4>
                      <p className="text-gray-400 text-sm">Automatically renew your subscription</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Email notifications</h4>
                      <p className="text-gray-400 text-sm">Receive billing notifications via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Usage alerts</h4>
                      <p className="text-gray-400 text-sm">Get notified when approaching plan limits</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-4">Billing Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={user?.businessName || ''}
                      className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      placeholder="123 Business Street"
                      className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="London"
                      className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      placeholder="SW1A 1AA"
                      className="block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                    Update Billing Address
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Plan Upgrade Modal */}
      <PlanUpgradeModal
        isOpen={showUpgradeModal}
        onClose={()=> setShowUpgradeModal(false)}
        currentPlan={currentPlan}
        onUpgrade={handlePlanUpgrade}
      />
    </div>
  );
}