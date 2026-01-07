
import React, { useState } from 'react';
import { Zap, LayoutDashboard, Upload, Settings, LogOut, Menu, X, HelpCircle, Calendar, Megaphone, BarChart3, Shield, Package, Server } from 'lucide-react';
import { User, UserRole, Language } from '../types';
import { canEditSettings } from '../types';
import { t } from '../services/i18n';
import { hasAdminAccess, isOwner } from '../services/permissionService';

interface NavigationProps {
  user: User;
  activeView: 'dashboard' | 'campaigns' | 'calendar' | 'products';
  setActiveView: (view: 'dashboard' | 'campaigns' | 'calendar' | 'products') => void;
  showAnalytics: boolean;
  setShowAnalytics: (v: boolean) => void;
  setShowImportModal: (v: boolean) => void;
  setShowSettingsModal: (v: boolean) => void;
  setShowHelpModal: (v: boolean) => void;
  setShowAdminDashboard?: (v: boolean) => void;
  setShowOwnerAdmin?: (v: boolean) => void;
  onLogout: () => void;
  language: Language;
}

const Navigation: React.FC<NavigationProps> = ({ 
  user, 
  activeView,
  setActiveView,
  showAnalytics, 
  setShowAnalytics, 
  setShowImportModal, 
  setShowSettingsModal, 
  setShowHelpModal,
  setShowAdminDashboard,
  setShowOwnerAdmin,
  onLogout,
  language
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NavItems = () => (
    <>
      {/* Top Section */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
          <Zap className="w-6 h-6 fill-current" />
        </div>
        
        {/* Main Views */}
        <button 
          onClick={() => { setActiveView('dashboard'); setIsMobileMenuOpen(false); }}
          title={t('dashboard', language)}
          className={`p-3 rounded-xl transition-all ${activeView === 'dashboard' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800 hover:text-white'}`}>
          <LayoutDashboard className="w-6 h-6" />
        </button>

        <button 
          onClick={() => { setActiveView('campaigns'); setIsMobileMenuOpen(false); }}
          title="Campaigns"
          className={`p-3 rounded-xl transition-all ${activeView === 'campaigns' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800 hover:text-white'}`}>
          <Megaphone className="w-6 h-6" />
        </button>

        <button 
          onClick={() => { setActiveView('calendar'); setIsMobileMenuOpen(false); }}
          title="Calendar"
          className={`p-3 rounded-xl transition-all ${activeView === 'calendar' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800 hover:text-white'}`}>
          <Calendar className="w-6 h-6" />
        </button>

        <button 
          onClick={() => { setActiveView('products'); setIsMobileMenuOpen(false); }}
          title="Products"
          className={`p-3 rounded-xl transition-all ${activeView === 'products' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800 hover:text-white'}`}>
          <Package className="w-6 h-6" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-slate-800/50 shrink-0"></div>

      {/* Middle Section - Utilities */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <button 
          onClick={() => { setShowAnalytics(!showAnalytics); setIsMobileMenuOpen(false); }}
          title="Toggle Analytics"
          className={`p-3 rounded-xl transition-all ${showAnalytics ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800 hover:text-white'}`}>
          <BarChart3 className="w-6 h-6" />
        </button>

        {canEditSettings(user.role) && (
          <button 
            onClick={() => { setShowImportModal(true); setIsMobileMenuOpen(false); }} 
            title={t('import', language)}
            className="p-3 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
            <Upload className="w-6 h-6" />
          </button>
        )}

        {hasAdminAccess(user) && setShowAdminDashboard && (
          <button 
            onClick={() => { setShowAdminDashboard(true); setIsMobileMenuOpen(false); }} 
            title="Admin Monitoring"
            className="p-3 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
            <Shield className="w-6 h-6" />
          </button>
        )}

        {isOwner(user) && setShowOwnerAdmin && (
          <button 
            onClick={() => { setShowOwnerAdmin(true); setIsMobileMenuOpen(false); }} 
            title="Owner Admin"
            className="p-3 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
            <Server className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Section - Spacer pushes this to bottom */}
      <div className="flex-1"></div>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <button 
          onClick={() => { setShowSettingsModal(true); setIsMobileMenuOpen(false); }} 
          title={t('settings', language)}
          className="p-3 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
          <Settings className="w-6 h-6" />
        </button>

        <button 
          onClick={() => { setShowHelpModal(true); setIsMobileMenuOpen(false); }} 
          title="Help & Documentation"
          className="p-3 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
          <HelpCircle className="w-6 h-6" />
        </button>

        <button 
          onClick={onLogout} 
          title={t('logout', language)}
          className="p-3 hover:bg-red-900/50 hover:text-red-400 rounded-xl transition-all text-slate-500">
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-20 bg-slate-900 flex-col items-center py-4 gap-3 text-slate-400 shrink-0 z-50 shadow-xl overflow-y-auto" style={{ height: '100vh', minHeight: '100vh', maxHeight: '100vh' }}>
        <NavItems />
      </div>

      {/* Mobile Bottom Nav (simplified) / Hamburger */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center p-2 z-[60] safe-area-pb shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] touch-feedback">
         <button 
           onClick={() => { setActiveView('dashboard'); setIsMobileMenuOpen(false); }} 
           className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg min-h-[44px] touch-feedback ${activeView === 'dashboard' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
           aria-label="Dashboard"
         >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Dashboard</span>
         </button>
         <button 
           onClick={() => { setActiveView('campaigns'); setIsMobileMenuOpen(false); }} 
           className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg min-h-[44px] touch-feedback ${activeView === 'campaigns' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
           aria-label="Campaigns"
         >
            <Megaphone className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Campaigns</span>
         </button>
         <button 
           onClick={() => { setActiveView('calendar'); setIsMobileMenuOpen(false); }} 
           className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg min-h-[44px] touch-feedback ${activeView === 'calendar' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
           aria-label="Calendar"
         >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Calendar</span>
         </button>
         <button 
           onClick={() => setIsMobileMenuOpen(true)} 
           className="flex-1 flex flex-col items-center justify-center p-2 rounded-lg min-h-[44px] touch-feedback text-slate-500"
           aria-label="More"
         >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">More</span>
         </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex justify-end"
          onClick={() => setIsMobileMenuOpen(false)}
        >
           <div 
             className="w-64 bg-slate-900 h-full flex flex-col items-start py-6 px-4 gap-4 text-slate-400 overflow-y-auto safe-area-pr"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="flex items-center justify-between w-full mb-4">
                <h2 className="text-white font-semibold text-lg">Menu</h2>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="text-white p-2 rounded-lg hover:bg-slate-800 touch-feedback min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Mobile-optimized menu items */}
              <div className="flex flex-col gap-2 w-full">
                <button 
                  onClick={() => { setShowAnalytics(!showAnalytics); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white touch-feedback min-h-[44px] text-left w-full"
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Analytics</span>
                </button>
                
                {canEditSettings(user.role) && (
                  <button 
                    onClick={() => { setShowImportModal(true); setIsMobileMenuOpen(false); }} 
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white touch-feedback min-h-[44px] text-left w-full"
                  >
                    <Upload className="w-5 h-5" />
                    <span>{t('import', language)}</span>
                  </button>
                )}
                
                {hasAdminAccess(user) && setShowAdminDashboard && (
                  <button 
                    onClick={() => { setShowAdminDashboard(true); setIsMobileMenuOpen(false); }} 
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white touch-feedback min-h-[44px] text-left w-full"
                  >
                    <Shield className="w-5 h-5" />
                    <span>Admin</span>
                  </button>
                )}
                
                {isOwner(user) && setShowOwnerAdmin && (
                  <button 
                    onClick={() => { setShowOwnerAdmin(true); setIsMobileMenuOpen(false); }} 
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white touch-feedback min-h-[44px] text-left w-full"
                  >
                    <Server className="w-5 h-5" />
                    <span>Owner Admin</span>
                  </button>
                )}
                
                <div className="border-t border-slate-700 my-2"></div>
                
                <button 
                  onClick={() => { setActiveView('products'); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white touch-feedback min-h-[44px] text-left w-full"
                >
                  <Package className="w-5 h-5" />
                  <span>Products</span>
                </button>
                
                <button 
                  onClick={() => { setShowSettingsModal(true); setIsMobileMenuOpen(false); }} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white touch-feedback min-h-[44px] text-left w-full"
                >
                  <Settings className="w-5 h-5" />
                  <span>{t('settings', language)}</span>
                </button>
                
                <button 
                  onClick={() => { setShowHelpModal(true); setIsMobileMenuOpen(false); }} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white touch-feedback min-h-[44px] text-left w-full"
                >
                  <HelpCircle className="w-5 h-5" />
                  <span>Help</span>
                </button>
                
                <div className="border-t border-slate-700 my-2"></div>
                
                <button 
                  onClick={onLogout} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-red-900/50 hover:text-red-400 touch-feedback min-h-[44px] text-left w-full text-slate-500"
                >
                  <LogOut className="w-5 h-5" />
                  <span>{t('logout', language)}</span>
                </button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
