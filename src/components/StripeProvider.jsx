import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_CONFIG } from '../lib/stripe';

// Initialize Stripe with the correct config
const stripePromise = loadStripe(STRIPE_CONFIG.publishableKey);

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