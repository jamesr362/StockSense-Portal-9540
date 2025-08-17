import { motion } from 'framer-motion';
import { RiCheckLine, RiStarLine, RiArrowRightLine } from 'react-icons/ri';
import { formatPrice } from '../lib/stripe';

export default function PricingCard({ 
  plan, 
  isPopular = false, 
  onSelectPlan, 
  currentPlan = null, 
  isLoading = false,
  buttonText = null 
}) {
  const isCurrentPlan = currentPlan === plan.id;
  const defaultButtonText = isCurrentPlan ? 'Current Plan' : 'Get Started';

  const handleSelectPlan = () => {
    if (plan.paymentLink && !isCurrentPlan) {
      // Open Stripe payment link in new tab
      window.open(plan.paymentLink, '_blank');
    } else if (onSelectPlan) {
      onSelectPlan(plan);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
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

      <div className="px-6 py-8">
        {/* Plan name and price */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
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
          {plan.price > 0 && (
            <p className="text-gray-400 mt-2 text-sm">
              Billed monthly • Cancel anytime
            </p>
          )}
        </div>

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
      </div>
    </motion.div>
  );
}