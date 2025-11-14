import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import Settings from './pages/Settings';
import SubscriptionManagement from './pages/SubscriptionManagement';
import Support from './pages/Support';
import Pricing from './pages/Pricing';
import PricingGuide from './pages/PricingGuide';
import PaymentSuccess from './pages/PaymentSuccess';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import StripeProvider from './components/StripeProvider';
import WebhookListener from './components/WebhookListener';

function AppRoutes() {
  const location = useLocation();

  // SECURE: Simplified initialization without client-side payment detection
  useEffect(() => {
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
        
        {/* Catch all route - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  // SECURE: Removed client-side payment detection logic
  // All subscription state changes are now handled by the backend webhook
  
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