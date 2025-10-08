import {Routes, Route, Navigate, useLocation} from 'react-router-dom';
import {useEffect} from 'react';
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
import {AuthProvider} from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PlatformAdminRoute from './components/PlatformAdminRoute';
import StripeProvider from './components/StripeProvider';
import WebhookListener from './components/WebhookListener';

function AppRoutes() {
  const location = useLocation();

  // Handle payment return URLs and webhook simulation
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    
    const paymentStatus = urlParams.get('payment_status') || hashParams.get('payment_status');
    const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
    const planId = urlParams.get('plan') || hashParams.get('plan');
    
    // Log payment returns for debugging
    if (paymentStatus || sessionId) {
      console.log('Payment return detected:', {
        paymentStatus,
        sessionId,
        planId,
        currentPath: location.pathname,
        fullUrl: window.location.href,
        hash: window.location.hash
      });

      // If we have payment success indicators, trigger webhook simulation
      if (paymentStatus === 'success' || sessionId) {
        console.log('Triggering webhook simulation for successful payment');
        
        // Dispatch custom event to trigger webhook processing
        window.dispatchEvent(new CustomEvent('paymentReturnDetected', {
          detail: {
            paymentStatus,
            sessionId,
            planId,
            timestamp: Date.now()
          }
        }));
      }
    }
  }, [location]);

  return (
    <>
      {/* Webhook listener for processing Stripe events */}
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