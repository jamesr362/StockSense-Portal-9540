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

  // **ENHANCED**: Better payment return detection and handling
  useEffect(() => {
    const handlePaymentReturns = async () => {
      try {
        // Import Stripe utilities
        const { detectPaymentReturn, handlePaymentLinkReturn } = await import('./lib/stripe');
        
        // Detect if this is a payment return
        const detection = detectPaymentReturn();
        
        if (detection.isPaymentReturn) {
          console.log('🎉 Payment return detected!', detection);
          
          // Handle different types of returns
          if (!window.location.href.includes('payment-success')) {
            console.log('🔄 Redirecting to payment success page...');
            
            // Try automatic redirect first
            const handled = handlePaymentLinkReturn();
            
            if (!handled) {
              // Manual redirect as fallback
              const sessionId = detection.sessionId || `cs_fallback_${Date.now()}`;
              const planId = detection.planId || 'professional';
              const userEmail = sessionStorage.getItem('paymentUserEmail') || '';
              
              const successUrl = `/#/payment-success?payment_status=success&plan=${planId}&session_id=${sessionId}&user_email=${encodeURIComponent(userEmail)}&source=app_router&timestamp=${Date.now()}`;
              
              console.log('🎯 Manual redirect to:', successUrl);
              setTimeout(() => {
                window.location.href = successUrl;
              }, 1000);
            }
          }
          
          // Trigger webhook simulation for successful payments
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('paymentReturnDetected', {
              detail: {
                ...detection,
                source: 'app_router',
                timestamp: Date.now()
              }
            }));
          }, 500);
        }
        
      } catch (error) {
        console.warn('⚠️ Error handling payment returns:', error);
      }
    };

    // Run payment return detection
    handlePaymentReturns();

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

  // **NEW**: Enhanced hash change detection for Payment Link returns
  useEffect(() => {
    const handleHashChange = async () => {
      try {
        const { detectPaymentReturn, handlePaymentLinkReturn } = await import('./lib/stripe');
        
        // Check for payment returns on hash changes
        const detection = detectPaymentReturn();
        
        if (detection.isPaymentReturn && !window.location.href.includes('payment-success')) {
          console.log('🔗 Payment return detected on hash change');
          handlePaymentLinkReturn();
        }
      } catch (error) {
        console.warn('⚠️ Error in hash change handler:', error);
      }
    };

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
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
        <Route path="/pricing-guide" element={<PricingGuide />} />
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
        {/* Catch all route - redirect to dashboard if logged in, otherwise to login */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  // **ENHANCED**: Better Stripe redirect detection
  useEffect(() => {
    // Set up global payment return detection
    const setupGlobalDetection = () => {
      // Listen for page visibility changes (when user returns from Stripe)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('📱 Page became visible - checking for payment returns...');
          
          setTimeout(async () => {
            try {
              const { detectPaymentReturn } = await import('./lib/stripe');
              const detection = detectPaymentReturn();
              
              if (detection.isPaymentReturn) {
                console.log('🎉 Payment return detected on visibility change!');
                // The main detection logic will handle the redirect
              }
            } catch (error) {
              console.warn('⚠️ Error in visibility change handler:', error);
            }
          }, 1000);
        }
      };
      
      // Listen for window focus (alternative detection method)
      const handleWindowFocus = () => {
        console.log('🔍 Window focused - checking payment status...');
        
        setTimeout(async () => {
          try {
            const { detectPaymentReturn } = await import('./lib/stripe');
            const detection = detectPaymentReturn();
            
            if (detection.isPaymentReturn && !window.location.href.includes('payment-success')) {
              console.log('🎯 Payment return detected on focus!');
              // Let the main handler deal with it
            }
          } catch (error) {
            console.warn('⚠️ Error in focus handler:', error);
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
    };
    
    // Set up detection
    const cleanup = setupGlobalDetection();
    
    return cleanup;
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