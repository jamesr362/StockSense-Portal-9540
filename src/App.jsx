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

  // Enhanced payment return handling and webhook simulation
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    
    const paymentStatus = urlParams.get('payment_status') || hashParams.get('payment_status');
    const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
    const planId = urlParams.get('plan') || hashParams.get('plan');
    const webhookTrigger = urlParams.get('webhook_trigger') || hashParams.get('webhook_trigger');
    
    // Enhanced detection of payment returns
    const isPaymentReturn = paymentStatus === 'success' || 
                           sessionId?.startsWith('cs_') ||
                           window.location.href.includes('payment-success') ||
                           webhookTrigger === 'true';
    
    // Log all payment-related URL parameters for debugging
    if (paymentStatus || sessionId || planId || webhookTrigger) {
      console.log('🔍 Payment-related parameters detected:', {
        paymentStatus,
        sessionId,
        planId,
        webhookTrigger,
        currentPath: location.pathname,
        fullUrl: window.location.href,
        hash: window.location.hash,
        search: location.search,
        isPaymentReturn
      });
    }

    // Trigger webhook simulation for successful payments
    if (isPaymentReturn) {
      console.log('🎯 Payment return detected, triggering webhook simulation...');
      
      // Dispatch custom event to trigger webhook processing
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('paymentReturnDetected', {
          detail: {
            paymentStatus,
            sessionId,
            planId,
            webhookTrigger,
            timestamp: Date.now(),
            source: 'app_router'
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