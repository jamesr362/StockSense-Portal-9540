import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Inventory from './pages/Inventory';
import ReceiptScanner from './pages/ReceiptScanner';
import ExcelImporter from './pages/ExcelImporter';
import TaxExports from './pages/TaxExports';
import Admin from './pages/Admin';
import PlatformAdmin from './pages/PlatformAdmin';
import Settings from './pages/Settings';
import SubscriptionManagement from './pages/SubscriptionManagement';
import Pricing from './pages/Pricing';
import PaymentSuccess from './pages/PaymentSuccess';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PlatformAdminRoute from './components/PlatformAdminRoute';
import StripeProvider from './components/StripeProvider';
import WebhookListener from './components/WebhookListener';

function AppRoutes() {
  const location = useLocation();

  // **ENHANCED**: Better payment return detection and handling
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    
    const paymentStatus = urlParams.get('payment_status') || hashParams.get('payment_status');
    const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
    const planId = urlParams.get('plan') || hashParams.get('plan');
    const webhookTrigger = urlParams.get('webhook_trigger') || hashParams.get('webhook_trigger');
    const source = urlParams.get('source') || hashParams.get('source');
    
    // **ENHANCED**: Detect payment returns from multiple sources
    const isPaymentReturn = paymentStatus === 'success' || 
                           sessionId?.startsWith('cs_') ||
                           window.location.href.includes('payment-success') ||
                           webhookTrigger === 'true' ||
                           source === 'focus_detection' ||
                           source === 'manual_redirect';

    // **NEW**: Detect return from Stripe (even without explicit parameters)
    const isStripeReturn = document.referrer.includes('stripe.com') ||
                          document.referrer.includes('buy.stripe.com') ||
                          sessionStorage.getItem('stripeRedirectAttempt') === 'true';
    
    // Log all payment-related URL parameters for debugging
    if (paymentStatus || sessionId || planId || webhookTrigger || isStripeReturn) {
      console.log('🔍 Payment-related activity detected:', {
        paymentStatus,
        sessionId,
        planId,
        webhookTrigger,
        source,
        isStripeReturn,
        referrer: document.referrer,
        currentPath: location.pathname,
        fullUrl: window.location.href,
        hash: window.location.hash,
        search: location.search,
        isPaymentReturn: isPaymentReturn || isStripeReturn
      });
    }

    // **ENHANCED**: Handle Stripe returns even without parameters
    if (isStripeReturn && !window.location.href.includes('payment-success')) {
      console.log('🔄 Detected return from Stripe, redirecting to payment success...');
      
      // Check for pending payment in localStorage
      const pendingPayment = JSON.parse(localStorage.getItem('pendingPayment') || 'null');
      
      if (pendingPayment) {
        const successUrl = `/#/payment-success?payment_status=success&plan=${pendingPayment.planId}&session_id=${pendingPayment.sessionId}&user_email=${encodeURIComponent(pendingPayment.userEmail)}&source=stripe_return&timestamp=${Date.now()}`;
        
        console.log('🎯 Redirecting to payment success with pending payment data:', successUrl);
        window.location.href = successUrl;
        return;
      } else {
        // Ask user if payment was successful
        const userConfirmed = confirm(
          'Did you complete your payment successfully?\n\n' +
          'Click OK if you just completed a payment, or Cancel if you didn\'t.'
        );
        
        if (userConfirmed) {
          const successUrl = `/#/payment-success?payment_status=success&plan=professional&session_id=cs_confirmed_${Date.now()}&source=user_confirmation&timestamp=${Date.now()}`;
          console.log('✅ User confirmed payment, redirecting:', successUrl);
          window.location.href = successUrl;
          return;
        }
      }
    }

    // Trigger webhook simulation for successful payments
    if (isPaymentReturn || isStripeReturn) {
      console.log('🎯 Payment return detected, triggering webhook simulation...');
      
      // Clear the redirect attempt flag
      sessionStorage.removeItem('stripeRedirectAttempt');
      
      // Dispatch custom event to trigger webhook processing
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('paymentReturnDetected', {
          detail: {
            paymentStatus: paymentStatus || 'success',
            sessionId: sessionId || `cs_return_${Date.now()}`,
            planId: planId || 'professional',
            webhookTrigger,
            source: source || 'app_router',
            timestamp: Date.now(),
            isStripeReturn
          }
        }));
      }, 500); // Small delay to ensure components are mounted
    }

    // Initialize database on app load
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing application...');
        
        // Import and initialize database if needed
        const { initializeDatabase, testDatabaseConnection } = await import('./services/supabaseSetup');
        
        const connectionTest = await testDatabaseConnection();
        if (!connectionTest) {
          console.log('🔧 Database needs initialization...');
          await initializeDatabase();
        } else {
          console.log('✅ Database connection verified');
        }
        
      } catch (error) {
        console.warn('⚠️ App initialization warning:', error);
        // Don't fail the app if database initialization fails
      }
    };

    // Run initialization only once
    const hasInitialized = sessionStorage.getItem('appInitialized');
    if (!hasInitialized) {
      initializeApp();
      sessionStorage.setItem('appInitialized', 'true');
    }

  }, [location]);

  // **NEW**: Listen for payment link redirects
  useEffect(() => {
    const handlePaymentLinkReturn = () => {
      // Check if we're being redirected from a payment link
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      
      // Look for Stripe-specific parameters or referrer
      const hasStripeIndicators = document.referrer.includes('stripe.com') ||
                                 document.referrer.includes('buy.stripe.com') ||
                                 urlParams.has('session_id') ||
                                 hashParams.has('session_id');
      
      if (hasStripeIndicators && !window.location.href.includes('payment-success')) {
        console.log('🔗 Payment link return detected, processing...');
        
        // **FIXED**: Correct import path for stripe module
        import('./lib/stripe').then(({ handlePaymentLinkReturn }) => {
          const handled = handlePaymentLinkReturn();
          if (!handled) {
            console.log('ℹ️ Payment link return not handled automatically');
          }
        });
      }
    };

    // Run immediately and on hash changes
    handlePaymentLinkReturn();
    window.addEventListener('hashchange', handlePaymentLinkReturn);
    
    return () => {
      window.removeEventListener('hashchange', handlePaymentLinkReturn);
    };
  }, []);

  return (
    <>
      {/* Enhanced Webhook listener for processing Stripe events */}
      <WebhookListener />
      
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="receipt-scanner" element={<ReceiptScanner />} />
          <Route path="excel-importer" element={<ExcelImporter />} />
          <Route path="tax-exports" element={<TaxExports />} />
          <Route path="settings/*" element={<Settings />} />
          <Route path="subscription" element={<SubscriptionManagement />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route
            path="platform-admin"
            element={
              <PlatformAdminRoute>
                <PlatformAdmin />
              </PlatformAdminRoute>
            }
          />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  // **NEW**: Set flag when we're about to redirect to Stripe
  useEffect(() => {
    const handleStripeRedirect = (event) => {
      console.log('🔗 Setting Stripe redirect flag...');
      sessionStorage.setItem('stripeRedirectAttempt', 'true');
    };

    window.addEventListener('beforeunload', (event) => {
      // Check if we're navigating to Stripe
      if (document.activeElement?.href?.includes('stripe.com')) {
        sessionStorage.setItem('stripeRedirectAttempt', 'true');
      }
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      <StripeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </StripeProvider>
    </div>
  );
}