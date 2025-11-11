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
    <div className="min-h-screen bg-gray-900 flex">
      {/* Desktop Sidebar - Fixed position */}
      <div className="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0 lg:z-40">
        <Sidebar 
          isMobileMenuOpen={false} 
          onMobileMenuClose={handleMobileMenuClose}
        />
      </div>

      {/* Mobile Sidebar */}
      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        onMobileMenuClose={handleMobileMenuClose}
      />
      
      {/* Main content area with proper desktop offset */}
      <div className="flex-1 lg:pl-80">
        <div className="flex flex-col min-h-screen">
          {/* Header */}
          <Header 
            onMobileMenuToggle={handleMobileMenuToggle}
            isMobileMenuOpen={isMobileMenuOpen}
          />
          
          {/* Main content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="h-full w-full max-w-none">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}