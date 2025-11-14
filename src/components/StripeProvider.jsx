import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { getStripeConfig } from '../lib/stripe';

// Initialize Stripe
const stripeConfig = getStripeConfig();
const stripePromise = loadStripe(stripeConfig.publishableKey);

export default function StripeProvider({ children }) {
  const options = {
    // Stripe Elements options
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#0ea5e9',
        colorBackground: '#1f2937',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      }
    }
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}