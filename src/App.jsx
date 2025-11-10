import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Purchases from './pages/Inventory'; // Import as Purchases but use existing file
import ReceiptScanner from './pages/ReceiptScanner';
import ExcelImporter from './pages/ExcelImporter';
import TaxExports from './pages/TaxExports';
import Admin from './pages/Admin';
import PlatformAdmin from './pages/PlatformAdmin';
import Settings from './pages/Settings';
import SubscriptionManagement from './pages/SubscriptionManagement';
import Support from './pages/Support';
import Pricing from './pages/Pricing';
import PricingGuide from './pages/PricingGuide';
import PaymentSuccess from './pages/PaymentSuccess';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PlatformAdminRoute from './components/PlatformAdminRoute';
import StripeProvider from './components/StripeProvider';
import WebhookListener from './components/WebhookListener';

function AppRoutes() {
  const location = useLocation();

  // Basic initialization without complex async operations
  useEffect(() => {
    // Simple payment return detection
    const checkPaymentReturn = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        
        const hasSessionId = urlParams.has('session_id') || hashParams.has('session_id');
        const hasPaymentStatus = urlParams.get('payment_status') === 'success' || hashParams.get('payment_status') === 'success';
        const isPaymentSuccess = window.location.href.includes('payment-success');
        
        if ((hasSessionId || hasPaymentStatus) && !isPaymentSuccess) {
          // Simple redirect to payment success page
          const sessionId = urlParams.get('session_id') || hashParams.get('session_id') || `cs_${Date.now()}`;
          const planId = urlParams.get('plan') || hashParams.get('plan') || 'professional';
          const userEmail = sessionStorage.getItem('paymentUserEmail') || '';
          
          const successUrl = `#/payment-success?payment_status=success&plan=${planId}&session_id=${sessionId}&user_email=${encodeURIComponent(userEmail)}&timestamp=${Date.now()}`;
          
          setTimeout(() => {
            window.location.hash = successUrl;
          }, 1000);
        }
      } catch (error) {
        // Silently handle errors to prevent app crashes
      }
    };

    // Safe database initialization
    const initializeApp = () => {
      try {
        // Only run once
        const hasInitialized = sessionStorage.getItem('appInitialized');
        if (hasInitialized) return;
        
        sessionStorage.setItem('appInitialized', 'true');
        
        // Simple initialization without external dependencies
        setTimeout(() => {
          // Dispatch ready event
          window.dispatchEvent(new CustomEvent('appInitialized'));
        }, 1000);
        
      } catch (error) {
        // Don't crash the app
      }
    };

    // Run checks
    checkPaymentReturn();
    initializeApp();

  }, [location]);

  return (
    <>
      {/* Webhook listener for processing Stripe events */}
      <WebhookListener />
      
      <Routes>
        {/* Public Routes */}
        <Route path="/home" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/pricing-guide" element={<PricingGuide />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        
        {/* Protected Routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="purchases" element={<Purchases />} />
          {/* Keep old inventory route for backwards compatibility */}
          <Route path="inventory" element={<Navigate to="/app/purchases" replace />} />
          <Route path="receipt-scanner" element={<ReceiptScanner />} />
          <Route path="excel-importer" element={<ExcelImporter />} />
          <Route path="tax-exports" element={<TaxExports />} />
          <Route path="support" element={<Support />} />
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

        {/* Root Route - Landing Page */}
        <Route path="/" element={<Landing />} />
        
        {/* Legacy Routes - Redirect to App */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/purchases" element={<Navigate to="/app/purchases" replace />} />
        <Route path="/inventory" element={<Navigate to="/app/purchases" replace />} />
        <Route path="/receipt-scanner" element={<Navigate to="/app/receipt-scanner" replace />} />
        <Route path="/excel-importer" element={<Navigate to="/app/excel-importer" replace />} />
        <Route path="/tax-exports" element={<Navigate to="/app/tax-exports" replace />} />
        <Route path="/support" element={<Navigate to="/app/support" replace />} />
        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
        <Route path="/subscription" element={<Navigate to="/app/subscription" replace />} />
        <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
        <Route path="/platform-admin" element={<Navigate to="/app/platform-admin" replace />} />
        
        {/* Catch all route - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  // Simple payment return detection without complex async operations
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
            
            const hasPaymentReturn = urlParams.has('session_id') || hashParams.has('session_id') ||
                                   urlParams.get('payment_status') === 'success' || 
                                   hashParams.get('payment_status') === 'success';
            
            if (hasPaymentReturn && !window.location.href.includes('payment-success')) {
              // Simple redirect logic
              const sessionId = urlParams.get('session_id') || hashParams.get('session_id') || `cs_${Date.now()}`;
              const planId = urlParams.get('plan') || hashParams.get('plan') || 'professional';
              
              window.location.hash = `#/payment-success?payment_status=success&plan=${planId}&session_id=${sessionId}&timestamp=${Date.now()}`;
            }
          } catch (error) {
            // Silently handle errors
          }
        }, 1000);
      }
    };
    
    const handleWindowFocus = () => {
      setTimeout(() => {
        try {
          const referrer = document.referrer || '';
          if (referrer.includes('stripe.com') || referrer.includes('buy.stripe.com')) {
            // Check if we should redirect to payment success
            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
            
            if (!window.location.href.includes('payment-success')) {
              window.location.hash = `#/payment-success?payment_status=success&plan=professional&session_id=cs_${Date.now()}&timestamp=${Date.now()}`;
            }
          }
        } catch (error) {
          // Silently handle errors
        }
      }, 500);
    };
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    
    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      <HashRouter>
        <StripeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </StripeProvider>
      </HashRouter>
    </div>
  );
}