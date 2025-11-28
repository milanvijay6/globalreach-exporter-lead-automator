
import React, { useState } from 'react';
import { Zap, LayoutDashboard, Upload, Settings, LogOut, Menu, X, HelpCircle, Calendar, Megaphone, BarChart3, Shield, Package } from 'lucide-react';
import { User, UserRole, Language } from '../types';
import { canEditSettings } from '../types';
import { t } from '../services/i18n';
import { hasAdminAccess } from '../services/permissionService';

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

        {(user.role === 'Owner' || user.email?.toLowerCase() === 'milanvijay24@gmail.com') && setShowOwnerAdmin && (
          <button 
            onClick={() => { setShowOwnerAdmin(true); setIsMobileMenuOpen(false); }} 
            title="Owner Admin"
            className="p-3 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
            <Shield className="w-6 h-6" />
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-[60] safe-area-pb shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
         <button onClick={() => { setActiveView('dashboard'); }} className={`p-2 rounded-lg ${activeView === 'dashboard' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}>
            <LayoutDashboard className="w-6 h-6" />
         </button>
         <button onClick={() => { setActiveView('campaigns'); }} className={`p-2 rounded-lg ${activeView === 'campaigns' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}>
            <Megaphone className="w-6 h-6" />
         </button>
         <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-500">
            <Menu className="w-6 h-6" />
         </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex justify-end">
           <div className="w-24 bg-slate-900 h-full flex flex-col items-center py-6 gap-6 text-slate-400 animate-in slide-in-from-right">
              <button onClick={() => setIsMobileMenuOpen(false)} className="mb-4 text-white">
                  <X className="w-6 h-6" />
              </button>
              <NavItems />
           </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
