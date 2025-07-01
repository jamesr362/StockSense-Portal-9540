import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Inventory from './pages/Inventory';
import ReceiptScanner from './pages/ReceiptScanner';
import ExcelImporter from './pages/ExcelImporter';
import Admin from './pages/Admin';
import PlatformAdmin from './pages/PlatformAdmin';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PlatformAdminRoute from './components/PlatformAdminRoute';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
      </AuthProvider>
    </div>
  );
}