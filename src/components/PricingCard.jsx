import {motion} from 'framer-motion';
import {RiCheckLine, RiStarLine, RiArrowRightLine, RiGiftLine} from 'react-icons/ri';
import {formatPrice} from '../lib/stripe';

export default function PricingCard({
  plan,
  isPopular = false,
  onSelectPlan,
  currentPlan = null,
  isLoading = false,
  buttonText = null,
  showFreeTrial = false
}) {
  const isCurrentPlan = currentPlan === plan.id;
  const defaultButtonText = isCurrentPlan ? 'Current Plan' : 'Get Started';

  const handleSelectPlan = () => {
    if (plan.paymentLink && !isCurrentPlan) {
      // For external payment links, let the parent component handle it
      onSelectPlan(plan);
    } else if (onSelectPlan) {
      onSelectPlan(plan);
    }
  };

  return (
    <motion.div
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.5}}
      className={`relative rounded-lg shadow-lg overflow-hidden ${
        isPopular || plan.highlighted
          ? 'border-2 border-primary-500 bg-gray-800'
          : 'border border-gray-700 bg-gray-800'
      }`}
    >
      {/* Popular badge */}
      {(isPopular || plan.highlighted) && (
        <div className="absolute top-0 right-0 bg-primary-500 text-white px-3 py-1 text-sm font-medium rounded-bl-lg">
          <div className="flex items-center">
            <RiStarLine className="h-4 w-4 mr-1" />
            Most Popular
          </div>
        </div>
      )}

      {/* Free Trial Badge */}
      {showFreeTrial && plan.price > 0 && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 text-xs font-bold rounded-br-lg">
          <div className="flex items-center">
            <RiGiftLine className="h-3 w-3 mr-1" />
            5-DAY FREE TRIAL
          </div>
        </div>
      )}

      <div className="px-6 py-8">
        {/* Plan name and price */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
          
          {/* Free Trial Pricing Display */}
          {showFreeTrial && plan.price > 0 ? (
            <div className="space-y-2">
              {/* Trial Period */}
              <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3">
                <div className="text-3xl font-extrabold text-green-400 mb-1">
                  FREE
                </div>
                <div className="text-sm text-green-300 font-medium">
                  First 5 days
                </div>
              </div>
              
              {/* Then Regular Price */}
              <div className="text-gray-400">
                <span className="text-lg">Then </span>
                <span className="text-2xl font-bold text-white">£{plan.price}</span>
                <span className="text-lg text-gray-400">/month</span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline justify-center">
              <span className="text-4xl font-extrabold text-white">
                {plan.price === 0 ? 'Free' : `£${plan.price}`}
              </span>
              {plan.price > 0 && (
                <span className="text-xl font-semibold text-gray-400 ml-1">
                  /month
                </span>
              )}
            </div>
          )}
          
          {plan.price > 0 && (
            <div className="mt-3 space-y-1">
              {showFreeTrial && (
                <p className="text-green-400 text-sm font-medium">
                  🎯 Try all features risk-free for 5 days
                </p>
              )}
              <p className="text-gray-400 text-sm">
                {showFreeTrial ? 'No charge during trial • ' : ''}Cancel anytime
              </p>
            </div>
          )}
        </div>

        {/* Free Trial Benefits */}
        {showFreeTrial && plan.price > 0 && (
          <div className="mb-6 bg-green-900/20 border border-green-700/30 rounded-lg p-4">
            <h4 className="text-green-400 font-semibold text-sm mb-2">
              ⭐ 5-Day Trial Includes:
            </h4>
            <ul className="text-green-300 text-xs space-y-1">
              <li>• Full access to all premium features</li>
              <li>• No setup fees or hidden costs</li>
              <li>• Cancel anytime during trial</li>
              <li>• Card secured but not charged</li>
            </ul>
          </div>
        )}

        {/* Features list */}
        <div className="space-y-4 mb-8">
          {plan.features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{opacity: 0, x: -20}}
              animate={{opacity: 1, x: 0}}
              transition={{duration: 0.3, delay: index * 0.1}}
              className="flex items-start"
            >
              <div className="flex-shrink-0 mr-3">
                <RiCheckLine className="h-5 w-5 text-green-400" />
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">{feature}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleSelectPlan}
          disabled={isCurrentPlan || isLoading}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center ${
            isCurrentPlan
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : isPopular || plan.highlighted
              ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </div>
          ) : (
            <>
              {buttonText || defaultButtonText}
              {!isCurrentPlan && <RiArrowRightLine className="h-4 w-4 ml-2" />}
            </>
          )}
        </button>

        {/* Instant Access Notice */}
        {!isCurrentPlan && plan.price > 0 && (
          <div className="mt-4 text-center">
            <p className="text-green-400 text-xs font-medium">
              {showFreeTrial ? '🎉 Start free trial instantly' : '⚡ Instant access after payment'}
            </p>
            {showFreeTrial && (
              <p className="text-gray-400 text-xs mt-1">
                Billing starts after 5-day trial period
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}