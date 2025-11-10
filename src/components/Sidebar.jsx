import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { RiDashboardLine, RiShoppingBag3Line, RiScanLine, RiFileExcelLine, RiCalculatorLine, RiAdminLine, RiGlobalLine, RiSettings3Line, RiCustomerServiceLine, RiTeamLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';

export default function Sidebar({ isMobileMenuOpen, onMobileMenuClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { canUseFeature, currentPlan } = useFeatureAccess();

  const navigation = [
    { name: 'Dashboard', href: '/app/dashboard', icon: RiDashboardLine },
    { name: 'Purchase Tracking', href: '/app/purchases', icon: RiShoppingBag3Line },
    { 
      name: 'Receipt Scanner', 
      href: '/app/receipt-scanner', 
      icon: RiScanLine,
      requiresFeature: 'receiptScanner',
      planRequired: 'Professional'
    },
    { 
      name: 'Excel Importer', 
      href: '/app/excel-importer', 
      icon: RiFileExcelLine,
      requiresFeature: 'excelImporter',
      planRequired: 'Professional'
    },
    { 
      name: 'Tax Exports', 
      href: '/app/tax-exports', 
      icon: RiCalculatorLine,
      requiresFeature: 'taxExports',
      planRequired: 'Professional'
    },
    { name: 'Support', href: '/app/support', icon: RiCustomerServiceLine },
    { name: 'Settings', href: '/app/settings', icon: RiSettings3Line },
  ];

  // Add admin routes based on user role
  if (user?.role === 'admin') {
    navigation.push({
      name: 'Admin Panel',
      href: '/app/admin',
      icon: RiAdminLine,
    });
  }

  if (user?.role === 'platformadmin') {
    navigation.push({
      name: 'Platform Admin',
      href: '/app/platform-admin',
      icon: RiGlobalLine,
    });
  }

  const isActive = (href) => {
    // Handle exact matches for nested routes
    if (href === '/app/dashboard') {
      return location.pathname === '/app/dashboard' || location.pathname === '/app' || location.pathname === '/app/';
    }
    if (href === '/app/purchases') {
      return location.pathname === '/app/purchases' || location.pathname === '/app/inventory';
    }
    // For other routes, check if current path starts with the href
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const handleNavClick = (href, requiresFeature) => {
    // Close mobile menu when navigating
    if (onMobileMenuClose) {
      onMobileMenuClose();
    }

    // Check if feature is available
    if (requiresFeature && !canUseFeature(requiresFeature)) {
      // Let the navigation happen - the page will show upgrade prompt
      console.log(`Feature ${requiresFeature} not available, but allowing navigation for upgrade prompt`);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo - Trackio Gradient Branding */}
      <div className="flex items-center flex-shrink-0 px-4 py-6">
        <div className="ml-3">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            Trackio
          </h1>
          <p className="text-xs text-gray-400">Purchase Management</p>
        </div>
      </div>

      {/* Current Plan Badge */}
      <div className="px-4 mb-4">
        <div className={`px-3 py-2 rounded-lg text-xs font-medium text-center ${
          currentPlan === 'professional' 
            ? 'bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-500/30 text-green-400'
            : 'bg-gray-800 border border-gray-700 text-gray-400'
        }`}>
          {currentPlan === 'professional' ? 'Professional Plan' : 'Free Plan'}
        </div>
        {currentPlan === 'free' && (
          <Link
            to="/pricing"
            className="block mt-2 px-3 py-2 bg-primary-600 text-white text-xs font-medium rounded-lg text-center hover:bg-primary-700 transition-colors"
          >
            Upgrade to Pro
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const hasFeatureAccess = !item.requiresFeature || canUseFeature(item.requiresFeature);
          const itemIsActive = isActive(item.href);
          
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => handleNavClick(item.href, item.requiresFeature)}
              className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                itemIsActive
                  ? 'bg-primary-900 text-primary-100 border-l-4 border-primary-500'
                  : hasFeatureAccess
                    ? 'text-gray-300 hover:bg-gray-800 hover:text-white border-l-4 border-transparent hover:border-gray-600'
                    : 'text-gray-500 hover:bg-gray-800 hover:text-gray-400 border-l-4 border-transparent'
              }`}
            >
              <item.icon
                className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors duration-200 ${
                  itemIsActive
                    ? 'text-primary-300'
                    : hasFeatureAccess
                      ? 'text-gray-400 group-hover:text-gray-300'
                      : 'text-gray-600'
                }`}
              />
              <span className="flex-1">{item.name}</span>
              {!hasFeatureAccess && item.planRequired && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded flex-shrink-0">
                  Pro
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="flex-shrink-0 px-4 py-4 border-t border-gray-700">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.businessName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.businessName || 'User'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors duration-200"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar - Fixed positioning with proper z-index */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:z-30">
        <div className="flex flex-col flex-grow bg-gray-900 overflow-y-auto border-r border-gray-800 shadow-xl">
          {sidebarContent}
        </div>
      </div>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Mobile sidebar overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden"
            >
              <div
                className="fixed inset-0 bg-gray-600 bg-opacity-75"
                onClick={onMobileMenuClose}
              />
            </motion.div>

            {/* Mobile sidebar panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 lg:hidden"
            >
              <div className="flex flex-col h-full overflow-y-auto border-r border-gray-800 shadow-xl">
                {sidebarContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}