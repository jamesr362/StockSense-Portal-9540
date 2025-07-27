import { motion } from 'framer-motion';
import { RiCheckLine, RiArrowRightLine, RiStarLine } from 'react-icons/ri';
import { formatPrice } from '../lib/stripe';

export default function PricingCard({
  plan,
  isPopular = false,
  onSelectPlan,
  currentPlan = null,
  isLoading = false,
  buttonText = null,
  billingInterval = 'monthly'
}) {
  const isCurrentPlan = currentPlan === plan.id;
  const isFree = plan.id === 'free';
  const price = billingInterval === 'yearly' && plan.yearlyPrice ? plan.yearlyPrice : plan.price;

  const getButtonText = () => {
    if (buttonText) return buttonText;
    if (isCurrentPlan) return 'Current Plan';
    if (isFree) return plan.ctaText || 'Start Free Trial';
    return plan.ctaText || 'Upgrade Now';
  };

  const getButtonStyle = () => {
    if (isCurrentPlan) {
      return 'bg-gray-700 text-gray-400 cursor-not-allowed';
    }
    if (isFree) {
      return 'bg-gray-600 text-white hover:bg-gray-700';
    }
    if (isPopular || plan.highlighted) {
      return 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl';
    }
    return 'bg-primary-600 text-white hover:bg-primary-700';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative rounded-lg shadow-lg overflow-hidden ${
        isPopular || plan.highlighted
          ? 'border-2 border-primary-500 bg-gray-800 scale-105'
          : isFree
          ? 'border border-gray-600 bg-gray-800'
          : 'border border-gray-700 bg-gray-800'
      }`}
    >
      {/* Badge */}
      {plan.badge && (
        <div
          className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-lg ${
            'bg-primary-500 text-white'
          }`}
        >
          <div className="flex items-center">
            {!isFree && <RiStarLine className="h-3 w-3 mr-1" />}
            {plan.badge}
          </div>
        </div>
      )}

      <div className="px-6 py-8">
        {/* Plan name and price */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
          <div className="flex items-baseline justify-center">
            <span className="text-4xl font-extrabold text-white">
              {isFree ? 'Free' : formatPrice(price)}
            </span>
            {!isFree && (
              <span className="text-xl font-semibold text-gray-400 ml-1">
                /{billingInterval === 'yearly' ? 'year' : 'month'}
              </span>
            )}
          </div>

          {/* Savings indicator for yearly */}
          {!isFree && billingInterval === 'yearly' && plan.savings && (
            <p className="text-green-400 text-sm mt-2 font-medium">
              {plan.savings}
            </p>
          )}

          {/* Monthly equivalent for yearly */}
          {!isFree && billingInterval === 'yearly' && plan.yearlyPrice && (
            <p className="text-gray-400 text-sm mt-1">
              {formatPrice(plan.yearlyPrice / 12)}/month billed annually
            </p>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-400 text-center mb-6">{plan.description}</p>

        {/* Features list */}
        <div className="space-y-4 mb-8">
          {plan.features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-start"
            >
              <div className="flex-shrink-0 mr-3">
                {isFree && (feature.includes('only') || feature.includes('3 ') || feature.includes('1 ')) ? (
                  <RiStarLine className="h-5 w-5 text-yellow-400" />
                ) : (
                  <RiCheckLine className="h-5 w-5 text-green-400" />
                )}
              </div>
              <p
                className={`text-sm leading-relaxed ${
                  isFree && (feature.includes('No ') || feature.includes('72h'))
                    ? 'text-gray-500 line-through'
                    : 'text-gray-300'
                }`}
              >
                {feature}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={() => onSelectPlan(plan, billingInterval)}
          disabled={isCurrentPlan || isLoading}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center ${getButtonStyle()}`}
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </div>
          ) : (
            <>
              {getButtonText()}
              {!isCurrentPlan && <RiArrowRightLine className="h-4 w-4 ml-2" />}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}