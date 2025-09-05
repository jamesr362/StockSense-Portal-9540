import {Outlet} from 'react-router-dom';
import {useState} from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import PaymentVerificationBanner from './PaymentVerificationBanner';
import useSubscriptionVerification from '../hooks/useSubscriptionVerification';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const {
    isVerifying,
    verificationStatus,
    dismissVerificationStatus
  } = useSubscriptionVerification();

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Payment Verification Banner */}
      <PaymentVerificationBanner
        isVerifying={isVerifying}
        verificationStatus={verificationStatus}
        onDismiss={dismissVerificationStatus}
      />
      
      {/* Main Layout */}
      <div className={isVerifying || verificationStatus ? 'mt-16' : ''}>
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