import {useState,useEffect} from 'react';
import {motion} from 'framer-motion';
import {RiCheckLine,RiArrowRightLine,RiStarLine} from 'react-icons/ri';
import {useAuth} from '../context/AuthContext';
import {useNavigate} from 'react-router-dom';
import {logSecurityEvent} from '../utils/security';
import {SUBSCRIPTION_PLANS,formatPrice} from '../lib/stripe';
import {getUserSubscriptionSupabase} from '../services/supabaseDb';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import PricingCard from '../components/PricingCard';

export default function Pricing() {
  const [billingInterval,setBillingInterval]=useState('monthly');
  const [isLoading,setIsLoading]=useState(false);
  const [error,setError]=useState(null);
  const [currentPlanId,setCurrentPlanId]=useState('free');
  const [isMobileMenuOpen,setIsMobileMenuOpen]=useState(false);
  const {user}=useAuth();
  const navigate=useNavigate();

  useEffect(()=> {
    logSecurityEvent('PRICING_PAGE_VIEW',{userEmail: user?.email,billingInterval});
    
    // Load user's current subscription plan
    const loadUserPlan=async ()=> {
      if (user?.email) {
        try {
          const subscription=await getUserSubscriptionSupabase(user.email);
          if (subscription && subscription.planId) {
            // Extract plan name from price ID (e.g.,"price_professional" -> "professional")
            const planName=subscription.planId.split('_')[1];
            if (planName && SUBSCRIPTION_PLANS[planName]) {
              setCurrentPlanId(planName);
            }
          }
        } catch (error) {
          console.error('Error loading subscription:',error);
        }
      }
    };

    loadUserPlan();
  },[user,billingInterval]);

  const handlePlanSelect=(plan)=> {
    if (!user) {
      navigate('/login');
      return;
    }

    // Don't allow selecting current plan
    if (plan.id===currentPlanId) {
      return;
    }

    // Don't allow downgrading from the UI (would need to go through subscription management)
    if (SUBSCRIPTION_PLANS[currentPlanId]?.price > plan.price) {
      setError("To downgrade your plan,please go to Settings > Billing & Subscription");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logSecurityEvent('PLAN_SELECTION',{
        planId: plan.id,
        userEmail: user.email,
        billingInterval
      });

      // For free plan,redirect to dashboard
      if (plan.id==='free') {
        navigate('/dashboard');
        return;
      }

      // For paid plans,redirect to Stripe or settings
      if (plan.paymentLink) {
        window.open(plan.paymentLink,'_blank');
      } else {
        navigate('/settings/billing');
      }
    } catch (err) {
      setError(err.message);
      logSecurityEvent('PLAN_SELECTION_ERROR',{
        error: err.message,
        planId: plan.id
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMobileMenuToggle=()=> {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose=()=> {
    setIsMobileMenuOpen(false);
  };

  const plans=Object.values(SUBSCRIPTION_PLANS);

  return (
    <div className="min-h-screen bg-gray-900">
      {user && (
        <>
          <Sidebar 
            isMobileMenuOpen={isMobileMenuOpen} 
            onMobileMenuClose={handleMobileMenuClose} 
          />
          <div className="lg:pl-72">
            <Header 
              onMobileMenuToggle={handleMobileMenuToggle} 
              isMobileMenuOpen={isMobileMenuOpen} 
            />
          </div>
        </>
      )}

      <div className="py-12 px-4 sm:px-6 lg:px-8 lg:pl-72">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{opacity: 0,y: 20}}
            animate={{opacity: 1,y: 0}}
            className="text-center mb-12"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Start your inventory management journey with a plan that fits your business needs
            </p>
          </motion.div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-12">
            <div className="bg-gray-800 rounded-lg p-1 inline-flex">
              <button
                onClick={()=> setBillingInterval('monthly')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  billingInterval==='monthly' 
                    ? 'bg-primary-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={()=> setBillingInterval('yearly')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  billingInterval==='yearly' 
                    ? 'bg-primary-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Yearly
                <span className="text-xs text-green-400 ml-1">Save 10%</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{opacity: 0,y: -10}}
              animate={{opacity: 1,y: 0}}
              className="mb-8 max-w-md mx-auto"
            >
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                <p className="text-red-300 text-sm text-center">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Current Plan Info */}
          {user && (
            <motion.div
              initial={{opacity: 0,y: -10}}
              animate={{opacity: 1,y: 0}}
              className="mb-8 max-w-md mx-auto"
            >
              <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-4 text-center">
                <p className="text-gray-300 text-sm">
                  Your current plan:{' '}
                  <span className="text-primary-400 font-semibold">
                    {SUBSCRIPTION_PLANS[currentPlanId]?.name || 'Free'}
                  </span>
                </p>
              </div>
            </motion.div>
          )}

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-7xl mx-auto">
            {plans.map((plan,index)=> (
              <PricingCard
                key={plan.id}
                plan={plan}
                isPopular={plan.highlighted}
                onSelectPlan={handlePlanSelect}
                currentPlan={currentPlanId}
                isLoading={isLoading}
                billingInterval={billingInterval}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile menu backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 lg:hidden" 
          onClick={handleMobileMenuClose} 
        />
      )}
    </div>
  );
}