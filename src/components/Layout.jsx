import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

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
      {/* Single Sidebar Component - handles both desktop and mobile internally */}
      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        onMobileMenuClose={handleMobileMenuClose}
      />
      
      {/* Main content area with proper desktop offset */}
      <div className="lg:pl-80">
        <div className="flex flex-col min-h-screen">
          {/* Header */}
          <Header 
            onMobileMenuToggle={handleMobileMenuToggle}
            isMobileMenuOpen={isMobileMenuOpen}
          />
          
          {/* Main content */}
          <main className="flex-1">
            <div className="h-full w-full">
              <div className="p-4 sm:p-6 lg:p-8">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}