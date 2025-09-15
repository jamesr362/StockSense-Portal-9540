import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import PaymentStatusHandler from './PaymentStatusHandler';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Payment Status Handler */}
      <PaymentStatusHandler />

      {/* Main Layout */}
      <div>
        <Sidebar 
          isMobileMenuOpen={isMobileMenuOpen} 
          onMobileMenuClose={handleMobileMenuClose} 
        />
        <div className="lg:pl-72">
          <Header 
            onMobileMenuToggle={handleMobileMenuToggle} 
            isMobileMenuOpen={isMobileMenuOpen} 
          />
          <main className="py-4 sm:py-6 lg:py-10">
            <div className="px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Mobile menu backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 lg:hidden" 
            onClick={handleMobileMenuClose} 
          />
        )}
      </div>
    </div>
  );
}