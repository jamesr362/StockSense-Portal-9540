import {NavLink} from 'react-router-dom';
import {RiDashboardLine, RiStore2Line, RiCloseLine, RiAdminLine, RiGlobalLine, RiScanLine, RiFileExcelLine, RiSettingsLine, RiMoneyDollarCircleLine} from 'react-icons/ri';
import {motion, AnimatePresence} from 'framer-motion';
import {useAuth} from '../context/AuthContext';

export default function Sidebar({isMobileMenuOpen, onMobileMenuClose}) {
  const {user} = useAuth();

  console.log('===Sidebar Debug===');
  console.log('Current user:', user);
  console.log('User role:', user?.role);
  console.log('Is admin?', user?.role === 'admin');
  console.log('Is platform admin?', user?.role === 'platformadmin');
  console.log('====================');

  // Navigation based on user role
  const getNavigation = () => {
    if (user?.role === 'platformadmin') {
      return [
        {name: 'Platform Admin', to: '/platform-admin', icon: RiGlobalLine}
      ];
    } else if (user?.role === 'admin') {
      return [
        {name: 'Admin Panel', to: '/admin', icon: RiAdminLine}
      ];
    } else {
      return [
        {name: 'Dashboard', to: '/dashboard', icon: RiDashboardLine},
        {name: 'Inventory', to: '/inventory', icon: RiStore2Line},
        {name: 'Receipt Scanner', to: '/receipt-scanner', icon: RiScanLine},
        {name: 'Excel Importer', to: '/excel-importer', icon: RiFileExcelLine},
        {name: 'Pricing', to: '/pricing', icon: RiMoneyDollarCircleLine},
        {name: 'Settings', to: '/settings', icon: RiSettingsLine}
      ];
    }
  };

  const navigation = getNavigation();

  const handleNavClick = () => {
    onMobileMenuClose();
  };

  const getRoleInfo = () => {
    switch (user?.role) {
      case 'platformadmin':
        return {
          icon: RiGlobalLine,
          color: 'text-red-400',
          label: 'Platform Administrator',
          description: 'System-wide access'
        };
      case 'admin':
        return {
          icon: RiAdminLine,
          color: 'text-purple-400',
          label: 'Administrator',
          description: 'Full system access'
        };
      default:
        return null;
    }
  };

  const roleInfo = getRoleInfo();

  return (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <motion.div
          initial={{x: -280}}
          animate={{x: 0}}
          exit={{x: -280}}
          transition={{type: "spring", stiffness: 300, damping: 30}}
          className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-gray-800 shadow-xl lg:translate-x-0 lg:static lg:inset-0"
        >
          {/* Mobile close button */}
          <div className="flex items-center justify-between h-16 px-4 lg:hidden">
            <h2 className="text-lg font-semibold text-white">Menu</h2>
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
              onClick={onMobileMenuClose}
            >
              <span className="sr-only">Close menu</span>
              <RiCloseLine className="h-6 w-6" />
            </button>
          </div>

          {/* Logo for desktop - perfectly centered */}
          <div className="hidden lg:flex lg:items-center lg:justify-center lg:h-16 lg:px-4">
            <h1 className="text-xl font-bold text-white">Trackio</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 px-4 py-4 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({isActive}) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
                onClick={handleNavClick}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="border-t border-gray-700 p-4">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-white">
                  {user?.businessName?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {user?.businessName}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Role info */}
          {roleInfo && (
            <div className="border-t border-gray-700 p-4">
              <div className="flex items-center">
                <roleInfo.icon className={`h-5 w-5 ${roleInfo.color} mr-2 flex-shrink-0`} />
                <div className="min-w-0 flex-1">
                  <span className={`text-sm ${roleInfo.color} font-medium block truncate`}>
                    {roleInfo.label}
                  </span>
                  <p className="text-xs text-gray-500 truncate">{roleInfo.description}</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Desktop sidebar - always visible on lg+ */}
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-1 bg-gray-800 shadow-xl">
          {/* Logo - perfectly centered */}
          <div className="flex items-center justify-center h-16 px-4">
            <h1 className="text-xl font-bold text-white">Trackio</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 px-4 py-4 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({isActive}) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="border-t border-gray-700 p-4">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-white">
                  {user?.businessName?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {user?.businessName}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Role info */}
          {roleInfo && (
            <div className="border-t border-gray-700 p-4">
              <div className="flex items-center">
                <roleInfo.icon className={`h-5 w-5 ${roleInfo.color} mr-2 flex-shrink-0`} />
                <div className="min-w-0 flex-1">
                  <span className={`text-sm ${roleInfo.color} font-medium block truncate`}>
                    {roleInfo.label}
                  </span>
                  <p className="text-xs text-gray-500 truncate">{roleInfo.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AnimatePresence>
  );
}