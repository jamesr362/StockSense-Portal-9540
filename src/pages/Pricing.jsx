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
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import PaymentVerificationBanner from '../components/PaymentVerificationBanner';
import useSubscriptionVerification from '../hooks/useSubscriptionVerification';

export default function Pricing() {
  const [isLoading,setIsLoading]=useState(false);
  const [error,setError]=useState(null);
  const [currentPlanId,setCurrentPlanId]=useState('free');
  const [isMobileMenuOpen,setIsMobileMenuOpen]=useState(false);
  const [showUpgradeModal,setShowUpgradeModal]=useState(false);
  const [selectedPlan,setSelectedPlan]=useState(null);
  const {user}=useAuth();
  const navigate=useNavigate();
  const {isVerifying,verificationStatus,dismissVerificationStatus}=useSubscriptionVerification();

  useEffect(()=> {
    logSecurityEvent('PRICING_PAGE_VIEW',{userEmail: user?.email});

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
  },[user]);

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
      setError("To downgrade your plan,please go to Settings > Subscription");
      return;
    }

    setError(null);
    setSelectedPlan(plan);

    // For free plan,just redirect to dashboard
    if (plan.id==='free') {
      navigate('/dashboard');
      return;
    }

    // For paid plans,open Stripe payment link in NEW TAB
    if (plan.paymentLink) {
      logSecurityEvent('STRIPE_PAYMENT_INITIATED',{
        planId: plan.id,
        userEmail: user.email,
        paymentUrl: plan.paymentLink,
        openMethod: 'new_tab'
      });

      // Open payment link in NEW TAB
      window.open(plan.paymentLink,'_blank','noopener,noreferrer');
      return;
    }

    // Fallback to upgrade modal
    setShowUpgradeModal(true);
    logSecurityEvent('PLAN_SELECTION',{
      planId: plan.id,
      userEmail: user.email
    });
  };

  const handleUpgrade=async (plan)=> {
    try {
      setIsLoading(true);

      // The upgrade logic is handled in the StripePaymentForm component
      // This is called after successful payment

      // Reload the current plan
      const subscription=await getUserSubscriptionSupabase(user.email);
      if (subscription && subscription.planId) {
        const planName=subscription.planId.split('_')[1];
        if (planName && SUBSCRIPTION_PLANS[planName]) {
          setCurrentPlanId(planName);
        }
      }

      setShowUpgradeModal(false);
      setSelectedPlan(null);
    } catch (error) {
      console.error('Upgrade error:',error);
      setError('Failed to complete upgrade. Please try again.');
      logSecurityEvent('PLAN_UPGRADE_ERROR',{
        error: error.message,
        planId: plan?.id
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
      {/* Payment Verification Banner */}
      <PaymentVerificationBanner
        isVerifying={isVerifying}
        verificationStatus={verificationStatus}
        onDismiss={dismissVerificationStatus}
      />

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

      <div className={`py-12 px-4 sm:px-6 lg:px-8 ${user ? 'lg:pl-72' : ''} ${isVerifying || verificationStatus ? 'mt-16' : ''}`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{opacity: 0,y: 20}}
            animate={{opacity: 1,y: 0}}
            className="text-center mb-8"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-6">
              Start your inventory management journey with a plan that fits your business needs
            </p>
          </motion.div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 max-w-4xl mx-auto">
            {plans.map((plan,index)=> (
              <PricingCard
                key={plan.id}
                plan={plan}
                isPopular={plan.highlighted}
                onSelectPlan={handlePlanSelect}
                currentPlan={currentPlanId}
                isLoading={isLoading}
                buttonText={
                  plan.id===currentPlanId
                    ? 'Current Plan'
                    : plan.price===0
                    ? 'Get Started Free'
                    : 'Get Started'
                }
              />
            ))}
          </div>

          {/* Payment Security Notice */}
          <motion.div
            initial={{opacity: 0,y: 20}}
            animate={{opacity: 1,y: 0}}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Secure Payment Processing</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-300 mb-4">
                <div className="flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  SSL Encrypted
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  Stripe Secure
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  PCI Compliant
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                All payments are processed securely through Stripe. Your payment information is encrypted and never stored on our servers.
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Mobile menu backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 lg:hidden"
          onClick={handleMobileMenuClose}
        />
      )}

      {/* Upgrade Modal */}
      <PlanUpgradeModal
        isOpen={showUpgradeModal}
        onClose={()=> {
          setShowUpgradeModal(false);
          setSelectedPlan(null);
        }}
        currentPlan={currentPlanId}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}