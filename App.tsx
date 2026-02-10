
import React, { useState, useEffect, useRef, useCallback, startTransition, Suspense, lazy } from 'react';
import { Download, Upload, Play, Zap, LayoutDashboard, Lock, Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingBar from './components/LoadingBar';
import { OwnerAuthService } from './services/ownerAuthService';

// Lazy load ALL heavy components for code splitting (fast initial load)
const ImporterList = lazy(() => import('./components/ImporterList'));
const ChatInterface = lazy(() => import('./components/ChatInterface'));
const LeadImportWizard = lazy(() => import('./components/LeadImportWizard'));
const ReportConfigModal = lazy(() => import('./components/ReportConfigModal'));
const LoginScreen = lazy(() => import('./components/LoginScreen'));
const PinLockScreen = lazy(() => import('./components/PinLockScreen'));
const Navigation = lazy(() => import('./components/Navigation'));
const HelpModal = lazy(() => import('./components/HelpModal'));
const SourceCodeViewer = lazy(() => import('./components/SourceCodeViewer'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const OwnerAdminPanel = lazy(() => import('./components/OwnerAdminPanel'));
const CampaignManager = lazy(() => import('./components/CampaignManager'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const AdminMonitoringDashboard = lazy(() => import('./components/AdminMonitoringDashboard'));
const ProductsCatalogPanel = lazy(() => import('./components/ProductsCatalogPanel'));

// Loading fallback component with skeleton screens
import { ImporterListSkeleton, ChatInterfaceSkeleton, AnalyticsDashboardSkeleton } from './components/skeletons';

const ComponentLoader: React.FC<{ type?: 'list' | 'chat' | 'analytics' | 'default' }> = ({ type = 'default' }) => {
  switch (type) {
    case 'list':
      return <ImporterListSkeleton />;
    case 'chat':
      return <ChatInterfaceSkeleton />;
    case 'analytics':
      return <AnalyticsDashboardSkeleton />;
    default:
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      );
  }
};

import { Importer, LeadStatus, Message, Channel, AppTemplates, DEFAULT_TEMPLATES, ReportConfig, SalesForecast, User, Language, PlatformConnection, MessageStatus, NotificationConfig, DEFAULT_NOTIFICATIONS, Campaign, CalendarEvent } from './types';
import { canExportData, canSendMessages } from './services/permissionService';
import { generateIntroMessage, generateAgentReply, analyzeLeadQuality, simulateImporterResponse, generateSalesForecast } from './services/geminiService';
import { simulateNetworkValidation, getOptimalChannel, validateContactFormat } from './services/validationService';
import { logSecurityEvent, loadUserSession, saveUserSession, clearUserSession, loadPlatformConnections, savePlatformConnections, refreshPlatformTokens } from './services/securityService';
import { MessagingService } from './services/messagingService';
import { loadPanelSizes, savePanelSizes, DEFAULT_PANEL_SIZES } from './services/userPreferencesService';
import { StorageService } from './services/storageService';
import { CampaignService } from './services/campaignService';
import { CalendarService } from './services/calendarService';
import { t } from './services/i18n';
import { isDesktop, isMobile, getPlatform, PlatformService } from './services/platformService';
import { LoadingService } from './services/loadingService';

// Mock Data
const MOCK_IMPORTERS: Importer[] = [
  {
    id: '1',
    name: 'David Chen',
    companyName: 'Tok Inc Limited',
    country: 'New Zealand',
    contactDetail: '+64 21 123 4567',
    productsImported: 'Corn Poha 500g x 12 pcs',
    quantity: '10 NOS',
    priceRange: '7.52 USD/unit',
    status: LeadStatus.PENDING,
    chatHistory: [],
    activityLog: [{id: 'log1', timestamp: Date.now() - 100000, type: 'system', description: 'Lead created manually'}],
    preferredChannel: Channel.WHATSAPP,
    channelSelectionMode: 'auto',
    validation: { isValid: true, errors: [], checkedAt: Date.now() },
    leadScore: 40,
    satisfactionIndex: 50
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    companyName: 'EuroFoods GmbH',
    country: 'Germany',
    contactDetail: 'sarah.j@eurofoods.de',
    productsImported: 'Basmati Rice 1kg',
    quantity: '20 MT',
    priceRange: 'Market Rate',
    status: LeadStatus.ENGAGED,
    chatHistory: [{id: 'm1', content: 'Hi', sender: 'agent', timestamp: Date.now(), channel: Channel.WHATSAPP, status: MessageStatus.READ}],
    activityLog: [{id: 'log2', timestamp: Date.now() - 200000, type: 'system', description: 'Lead imported'}],
    preferredChannel: Channel.WHATSAPP,
    channelSelectionMode: 'auto',
    validation: { isValid: true, errors: [], checkedAt: Date.now() },
    leadScore: 65,
    satisfactionIndex: 70
  }
];

const DEFAULT_REPORT_CONFIG: ReportConfig = {
    timeFrame: '30d',
    kpis: { revenue: true, conversion: true, leads: true },
    exportSchedule: 'weekly',
    emailRecipients: '' // Deprecated - email functionality removed
};

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [connectedPlatforms, setConnectedPlatforms] = useState<PlatformConnection[]>([]);
  const [importers, setImportersRaw] = useState<Importer[]>([]);
  
  // Global update lock and queue system - declare early
  const setImportersCallCountRef = useRef(0);
  const lastSetImportersTimeRef = useRef(0);
  const setImportersBlockedRef = useRef(false);
  const updateQueueRef = useRef<Array<Importer[] | ((prev: Importer[]) => Importer[])>>([]);
  const isProcessingQueueRef = useRef(false);
  const globalUpdateLockRef = useRef(false);
  const setImportersDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Process update queue
  const processUpdateQueue = useCallback(() => {
    // Don't process if already processing or circuit breaker is tripped
    if (isProcessingQueueRef.current || setImportersBlockedRef.current) {
      return;
    }
    
    // If global lock is active, still allow processing but log it (for imports)
    if (globalUpdateLockRef.current) {
      console.log('[App] Processing queue despite global lock (may be import operation)');
    }
    
    if (updateQueueRef.current.length === 0) {
      return;
    }
    
    isProcessingQueueRef.current = true;
    
    try {
      // Get the last update in the queue (most recent)
      const lastUpdate = updateQueueRef.current[updateQueueRef.current.length - 1];
      updateQueueRef.current = []; // Clear queue
      
      // Apply the update directly to raw setter (bypass queue to avoid recursion)
      setImportersRaw(lastUpdate);
    } catch (error: any) {
      console.error('[App] Error processing update queue:', error);
      // Reset flags on error
      isProcessingQueueRef.current = false;
      setImportersBlockedRef.current = false;
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, []);
  
  // Circuit breaker: Wrap setImporters to prevent recursive calls with queue system
  const setImporters = useCallback((updater: Importer[] | ((prev: Importer[]) => Importer[])) => {
    // If circuit breaker is tripped, block all calls (check this first)
    if (setImportersBlockedRef.current) {
      console.warn('[App] ⚠️ setImporters blocked - circuit breaker tripped');
      return;
    }
    
    // If global lock is active, still allow but queue it (for imports, we need to allow the import itself)
    if (globalUpdateLockRef.current) {
      console.log('[App] ⚠️ setImporters queued - global lock active (may be import operation)');
      // Don't return - allow it to be queued
    }
    
    const now = Date.now();
    setImportersCallCountRef.current += 1;
    
    // If called more than 3 times in 50ms, we're in a loop - trip circuit breaker (balanced)
    if (now - lastSetImportersTimeRef.current < 50) {
      if (setImportersCallCountRef.current > 3) {
        console.error('🚨 [App] CIRCUIT BREAKER TRIPPED: setImporters called too rapidly!', {
          count: setImportersCallCountRef.current,
          timeDiff: now - lastSetImportersTimeRef.current
        });
        console.trace('Stack trace:');
        // Trip the circuit breaker
        setImportersBlockedRef.current = true;
        updateQueueRef.current = []; // Clear queue
        // Reset after 3 seconds (balanced cooldown)
        setTimeout(() => {
          setImportersBlockedRef.current = false;
          setImportersCallCountRef.current = 0;
          console.log('[App] Circuit breaker auto-reset');
        }, 3000);
        return; // Block the call
      }
    } else {
      // Reset counter if enough time has passed
      setImportersCallCountRef.current = 0;
    }
    
    lastSetImportersTimeRef.current = now;
    
    // Add to queue instead of direct update
    updateQueueRef.current.push(updater);
    
    // Clear any pending queue processing
    if (setImportersDebounceRef.current) {
      clearTimeout(setImportersDebounceRef.current);
    }
    
    // Process queue after a short delay to batch updates
    setImportersDebounceRef.current = setTimeout(() => {
      processUpdateQueue();
      setImportersDebounceRef.current = null;
    }, 30); // Reduced debounce to 30ms for better responsiveness
  }, [processUpdateQueue]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importerTypingMap, setImporterTypingMap] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'campaigns' | 'calendar' | 'products'>('dashboard');
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showReportConfig, setShowReportConfig] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState<boolean>(false);
  const [templates, setTemplates] = useState<AppTemplates>(DEFAULT_TEMPLATES);
  const [reportConfig, setReportConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATIONS);
  const [language, setLanguage] = useState<Language>('en');
  const [forecastData, setForecastData] = useState<SalesForecast[] | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768 || isMobile());
  const [showOwnerAdmin, setShowOwnerAdmin] = useState(false);
  const [showSourceCodeViewer, setShowSourceCodeViewer] = useState(false);
  
  // isSetupComplete is null initially to represent "loading" state
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  // Campaigns & Calendar
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Resizable Panel State
  const [importerListWidth, setImporterListWidth] = useState<number>(DEFAULT_PANEL_SIZES.importerListWidth);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  // --- Effects ---

  useEffect(() => {
    const init = async () => {
        const initTaskId = 'app_init';
        try {
            LoadingService.start(initTaskId, 'Initializing application...');
            
            // Check for existing user session first
            const savedUser = await loadUserSession();
            
            // If user session exists, load data and proceed
                if (savedUser) {
                    // User exists - load data and proceed
                    setUser(savedUser);
                    logSecurityEvent('SESSION_RESTORE', savedUser.id, 'Restored from secure storage');
                    
                    LoadingService.updateProgress(initTaskId, 30);
                    
                    // Load PIN verifications
                    const { PinService } = await import('./services/pinService');
                    await PinService.loadPinVerifications();
                    
                    LoadingService.updateProgress(initTaskId, 50);
                    
                    // Initialize SQLite for mobile (if available)
                    try {
                      const { initializeSQLite } = await import('./services/sqliteService');
                      await initializeSQLite();
                      console.log('[App] SQLite initialized');
                    } catch (error) {
                      console.warn('[App] SQLite initialization failed (non-critical):', error);
                    }
                    
                    LoadingService.updateProgress(initTaskId, 60);
                    
                    // Load all user-specific data
                    await loadInitialAppData(savedUser);
                    
                    LoadingService.updateProgress(initTaskId, 80);
                    
                    // Perform incremental sync on app start
                    try {
                      const { performIncrementalSync } = await import('./services/incrementalSyncService');
                      await performIncrementalSync();
                      console.log('[App] Initial sync completed');
                    } catch (error) {
                      console.warn('[App] Initial sync failed (non-critical):', error);
                    }
                    
                    // Initialize push notifications (mobile only)
                    try {
                      const { initializePushNotifications } = await import('./services/pushNotificationService');
                      await initializePushNotifications();
                      console.log('[App] Push notifications initialized');
                    } catch (error) {
                      console.warn('[App] Push notifications initialization failed (non-critical):', error);
                    }
                    
                    // Load panel size preferences
                    const panelSizes = await loadPanelSizes(savedUser.id);
                    setImporterListWidth(panelSizes.importerListWidth);
                    
                    LoadingService.updateProgress(initTaskId, 100);
                    LoadingService.complete(initTaskId);
                    setIsSetupComplete(true);
                } else {
                    // No user session - setup is complete (no wizard needed)
                    LoadingService.complete(initTaskId);
                    setIsSetupComplete(true);
            }
            // If no user session, LoginScreen will be shown (handled in render logic)
        } catch (e) {
            console.error("Initialization failed", e);
            LoadingService.stop(initTaskId);
            setIsSetupComplete(true); // Allow app to proceed even on error
        }
    };
    init();
  }, []);

  // Session refresh mechanism - refresh session periodically and on user activity
  useEffect(() => {
    if (!user) return;

    // Refresh session every hour
    const refreshInterval = setInterval(async () => {
      try {
        const currentUser = await loadUserSession();
        if (currentUser && currentUser.id === user.id) {
          // Session is still valid, refresh it
          await saveUserSession(currentUser);
          console.log('[App] Session refreshed');
        } else if (!currentUser) {
          // Session expired or invalid, log out
          console.warn('[App] Session expired, logging out');
          setUser(null);
          await clearUserSession();
        }
      } catch (error) {
        console.error('[App] Session refresh failed:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    // Refresh session on user activity (mouse move, click, keypress)
    const activityHandlers = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'] as const;
    const handleActivity = async () => {
      try {
        const currentUser = await loadUserSession();
        if (currentUser && currentUser.id === user.id) {
          // Extend session on activity (only if close to expiry)
          await saveUserSession(currentUser);
        }
      } catch (error) {
        // Silently fail - don't interrupt user activity
      }
    };

    // Throttle activity handler to avoid excessive saves
    let activityTimeout: NodeJS.Timeout | null = null;
    const throttledActivityHandler = () => {
      if (activityTimeout) return;
      activityTimeout = setTimeout(() => {
        handleActivity();
        activityTimeout = null;
      }, 5 * 60 * 1000); // Every 5 minutes max
    };

    activityHandlers.forEach(event => {
      window.addEventListener(event, throttledActivityHandler, { passive: true });
    });

    return () => {
      clearInterval(refreshInterval);
      activityHandlers.forEach(event => {
        window.removeEventListener(event, throttledActivityHandler);
      });
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
    };
  }, [user]);

  // Check for OAuth callback in URL parameters and open modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCallback = urlParams.get('oauth_callback');
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    // Always check for OAuth callback
    // If user is not logged in, we still need to handle the callback (user might log in first)
    if (oauthCallback === 'true' && code) {
      console.log('[App] OAuth callback detected in URL', { 
        hasCode: !!code, 
        hasState: !!state, 
        hasUser: !!user 
      });
      
      if (user) {
        // User is logged in - open settings modal to handle callback
        setShowSettingsModal(true);
        // The SettingsModal and EmailOAuthModal will detect the URL parameters when they open
                } else {
        // User not logged in yet - store callback info and wait for login
        // The callback will be processed after user logs in
        console.log('[App] OAuth callback received but user not logged in - will process after login');
        }
    }
  }, [user]);

  useEffect(() => {
      // Background Token Refresh Loop
      const interval = setInterval(async () => {
          if (user && connectedPlatforms.length > 0) {
              const refreshed = await refreshPlatformTokens(connectedPlatforms);
              setConnectedPlatforms(refreshed);
              
              // Also refresh email connection separately if it exists
              const emailConn = refreshed.find(p => p.channel === Channel.EMAIL);
              if (emailConn && emailConn.emailCredentials) {
                const { refreshEmailTokens, saveEmailConnection } = await import('./services/securityService');
                const refreshedEmail = await refreshEmailTokens(emailConn.emailCredentials);
                if (refreshedEmail) {
                  const updatedEmailConn = { ...emailConn, emailCredentials: refreshedEmail };
                  await saveEmailConnection(refreshedEmail, emailConn.accountName);
                  setConnectedPlatforms(refreshed.map(p => 
                    p.channel === Channel.EMAIL ? updatedEmailConn : p
                  ));
                }
              }
          }
      }, 5 * 60 * 1000); // Every 5 minutes
      return () => clearInterval(interval);
  }, [user, connectedPlatforms]);

  // Save importers to storage (debounced to prevent excessive saves during rapid updates)
  const importersRef = useRef(importers);
  const lastSavedIdsRef = useRef<string>('');
  const saveCallCountRef = useRef(0);
  const saveCallTimesRef = useRef<number[]>([]);
  importersRef.current = importers; // Always keep ref in sync
  
  // Prevent save during imports to avoid loops - declare these early
  const importInProgressRef = useRef(false);
  const importCallStackRef = useRef<string[]>([]);
  const importDepthRef = useRef(0);
  const isSavingRef = useRef(false);
  const saveBlockedRef = useRef(false);
  
  useEffect(() => {
    // CRITICAL: Skip save if import is in progress or if save is blocked
    // This must be the FIRST check to prevent any execution
    if (importInProgressRef.current || saveBlockedRef.current || isSavingRef.current) {
      console.log('[App] ⏸️ Skipping save - import in progress or save blocked', {
        importInProgress: importInProgressRef.current,
        saveBlocked: saveBlockedRef.current,
        isSaving: isSavingRef.current
      });
      return; // Early return - don't execute ANY code below
    }
    
    // Additional safety: If we're in the middle of an import, abort immediately
    if (importInProgressRef.current) {
      return;
    }
    
    saveCallCountRef.current += 1;
    const callNumber = saveCallCountRef.current;
    const now = Date.now();
    saveCallTimesRef.current.push(now);
    
    // Keep only last 10 call times
    if (saveCallTimesRef.current.length > 10) {
      saveCallTimesRef.current.shift();
    }
    
    // Check for rapid calls (potential infinite loop)
    if (saveCallTimesRef.current.length >= 3) {
      const recentCalls = saveCallTimesRef.current.slice(-3);
      const timeDiff = recentCalls[recentCalls.length - 1] - recentCalls[0];
      if (timeDiff < 100) {
        console.error('🚨 [App] Save importers useEffect called rapidly! BLOCKING SAVE', {
          callNumber,
          callsIn100ms: recentCalls.length,
          timeDiff,
          importersLength: importers.length
        });
        console.trace('Stack trace:');
        // Block saves for a short time to prevent loop
        saveBlockedRef.current = true;
        setTimeout(() => {
          saveBlockedRef.current = false;
        }, 1000);
        return;
      }
    }
    
    console.log('[App] Save importers useEffect triggered', {
      callNumber,
      importersLength: importers.length,
      timestamp: new Date().toISOString()
    });
    
    if (importers.length > 0) {
      // Use a longer timeout to debounce rapid state changes and prevent infinite loops
      const timeoutId = setTimeout(async () => {
        // Double-check before saving
        if (importInProgressRef.current || saveBlockedRef.current || isSavingRef.current) {
          console.log('[App] ⏸️ Save cancelled - conditions changed');
          return;
        }
        
        isSavingRef.current = true;
        try {
          // Only save if importers actually changed (compare by length and IDs)
          const currentIds = importers.map(i => i.id).sort().join(',');
          
          if (currentIds !== lastSavedIdsRef.current) {
            console.log('[App] 💾 Saving importers to storage:', {
              callNumber,
              count: importers.length,
              ids: currentIds.substring(0, 100) + '...',
              timestamp: new Date().toISOString()
            });
            if (user?.id) {
              await StorageService.saveImporters(importers, user.id);
            }
            lastSavedIdsRef.current = currentIds;
          } else {
            console.log('[App] ⏭️ Importers unchanged, skipping save', {
              callNumber,
              count: importers.length
            });
          }
        } catch (error) {
          console.error('[App] ❌ Failed to save importers:', error);
          console.error('[App] Error stack:', (error as Error)?.stack);
          console.error('[App] Error details:', {
            message: (error as Error)?.message,
            name: (error as Error)?.name,
            callNumber
          });
        } finally {
          isSavingRef.current = false;
        }
      }, 500); // Increased debounce time to 500ms
      
      return () => {
        console.log('[App] Cleanup save importers timeout', { callNumber });
        clearTimeout(timeoutId);
      };
    }
  }, [importers.length]); // Only depend on length, not the array itself

  // Deep Link Handling for Magic Links and OAuth
  useEffect(() => {
    if (!(window as any).electronAPI) return;

    const handleDeepLink = async (event: any, url: string) => {
      try {
        const { LinkHandlerService } = await import('./services/linkHandlerService');
        const { AuthLogService } = await import('./services/authLogService');
        
        AuthLogService.logLinkClick({
          source: 'app',
          url: url.substring(0, 200),
          type: url.includes('magic-link') ? 'magic-link' : url.includes('oauth') ? 'oauth' : 'unknown',
          success: false, // Will update on completion
        });

        const result = await LinkHandlerService.handleLoginLink(url);
        
        if (result.valid && result.parsed) {
          AuthLogService.logLinkClick({
            source: 'app',
            url: url.substring(0, 200),
            type: result.parsed.type,
            success: true,
          });
          
          // Route to appropriate handler
          if (result.parsed.type === 'magic-link' && result.parsed.token) {
            // Process magic link
            if ((window as any).electronAPI) {
              (window as any).electronAPI.handleDeepLink(url);
            }
          } else if (result.parsed.type === 'oauth' && result.parsed.code) {
            // OAuth callback will be handled by PlatformConnectModal
            if ((window as any).electronAPI) {
              (window as any).electronAPI.handleDeepLink(url);
            }
          }
        } else {
          AuthLogService.logLinkClick({
            source: 'app',
            url: url.substring(0, 200),
            type: 'unknown',
            success: false,
            error: result.error,
          });
        }
      } catch (error: any) {
        console.error('[App] Deep link handling error:', error);
      }
    };

    (window as any).electronAPI.onDeepLink?.(handleDeepLink);
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Email functionality removed - all email ingestion code has been removed

  // Campaign Heartbeat - use ref to avoid dependency on importers
  const importersForCampaignRef = useRef(importers);
  useEffect(() => {
    importersForCampaignRef.current = importers;
  }, [importers]);

  useEffect(() => {
      console.log('[App] Campaign heartbeat useEffect triggered', {
        campaignsCount: campaigns.length,
        templatesCount: Object.keys(templates).length,
        timestamp: new Date().toISOString()
      });
      
      const interval = setInterval(async () => {
          // Skip if import is in progress or circuit breaker is tripped
          if (importInProgressRef.current || setImportersBlockedRef.current) {
            console.log('[App] ⏸️ Campaign processing skipped - import in progress or circuit breaker active');
            return;
          }
          
          // Use ref to get latest importers without causing re-renders
          const currentImporters = importersForCampaignRef.current;
          const { importers: updatedImporters, events: newEvents } = await CampaignService.processCampaigns(
              currentImporters, 
              campaigns, 
              templates, 
              (imp, msg, ch) => sendMessage(imp, msg, ch)
          );
          
          // Only update if there are actual changes and circuit breaker/global lock is not active
          if (setImportersBlockedRef.current || globalUpdateLockRef.current) {
            console.log('[App] ⏸️ Campaign update skipped - circuit breaker or global lock active');
            return;
          }
          
          if (updatedImporters && updatedImporters.length !== currentImporters.length) {
            setImporters(updatedImporters);
          } else if (updatedImporters) {
            // Check if any importer actually changed
            const hasChanges = updatedImporters.some((updated, idx) => {
              const current = currentImporters[idx];
              return !current || updated.id !== current.id || 
                     JSON.stringify(updated) !== JSON.stringify(current);
            });
            if (hasChanges) {
              setImporters(updatedImporters);
            }
          }
          
          if (newEvents.length > 0) setCalendarEvents(prev => [...prev, ...newEvents]);

      }, 60000); // Check every minute
      return () => clearInterval(interval);
  }, [campaigns, templates]); // Removed importers from dependencies

  // Auto-resize handler for responsive UI updates
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      setIsMobileView(newWidth < 768 || isMobile());
      setWindowSize({ width: newWidth, height: newHeight });
    };
    
    // Initial call
    handleResize();
    
    // Throttle resize events for performance
    let resizeTimeout: NodeJS.Timeout;
    const throttledResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 150);
    };
    
    window.addEventListener('resize', throttledResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', throttledResize);
      window.removeEventListener('orientationchange', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Auto-select first importer on desktop - only when list changes, not on every render
  const prevImportersLengthRef = useRef(importers.length);
  useEffect(() => {
    // Skip if import is in progress to prevent interference
    if (importInProgressRef.current) {
      return;
    }
    
    // Only auto-select if importers list length changed (new items added) and we're on desktop
    if (!isMobileView && !selectedId && importers.length > 0 && importers.length !== prevImportersLengthRef.current) {
      setSelectedId(importers[0].id);
      prevImportersLengthRef.current = importers.length;
    } else if (importers.length !== prevImportersLengthRef.current) {
      prevImportersLengthRef.current = importers.length;
    }
  }, [isMobileView, importers.length, selectedId]); // Only depend on length, not the array

  // Auto-response rate limiting (per conversation)
  const lastAutoResponseTime = useRef<Record<string, number>>({});
  const dailyAutoResponseCount = useRef<Record<string, number>>({}); // Track daily count per importer
  const AUTO_RESPONSE_COOLDOWN_MS_CLOUD_API = 5 * 60 * 1000; // 5 minutes for Cloud API
  const AUTO_RESPONSE_COOLDOWN_MS_WEB = 30 * 60 * 1000; // 30 minutes for WhatsApp Web
  const MAX_DAILY_AUTO_RESPONSES_WEB = 10; // Maximum auto-responses per day via WhatsApp Web
  const ESCALATION_KEYWORDS = ['manager', 'human', 'help', 'support', 'complaint', 'urgent', 'problem'];
  
  // Helper to check if WhatsApp Web is being used
  const isUsingWhatsAppWeb = useCallback(async (): Promise<boolean> => {
    try {
      const config = await PlatformService.getAppConfig('whatsapp', { method: 'cloud_api' });
      return config?.method === 'web' || config?.web?.enabled === true;
    } catch {
      return false;
    }
  }, []);

  // Auto-Update & Webhook Listener (Desktop Only)
  useEffect(() => {
      if (isDesktop() && window.electronAPI) {
          window.electronAPI.onUpdateAvailable(() => {
              if (Notification.permission === 'granted') {
                  new Notification('Update Available', { body: 'A new version is ready to install.' });
              }
          });

          window.electronAPI.onWebhookPayload(async (_event, { channel, payload, timestamp }) => {
              console.log("Received Webhook:", channel, payload);
              
              if (channel === 'WhatsApp') {
                  // Use WhatsAppService to parse the webhook
                  const { WhatsAppService } = await import('./services/whatsappService');
                  const parsed = WhatsAppService.parseIncomingWebhook(payload);
                  
                  // Process status updates
                  for (const status of parsed.statuses) {
                      setImporters(prev => prev.map(imp => {
                          const msgIndex = imp.chatHistory.findIndex(m => m.id === status.messageId);
                          if (msgIndex >= 0) {
                              return {
                                  ...imp,
                                  chatHistory: imp.chatHistory.map((m, idx) => 
                                      idx === msgIndex ? { ...m, status: status.status } : m
                                  )
                              };
                          }
                          return imp;
                      }));
                  }
                  
                  // Process incoming messages
                  for (const msg of parsed.messages) {
                      const contact = msg.from;
                      const content = msg.content;
                      
                      if (content && contact) {
                          setImporters(prev => {
                              // Normalize phone numbers for matching
                              const normalizePhone = (phone: string) => phone.replace(/[\s+\-()]/g, '');
                              const normalizedContact = normalizePhone(contact);
                              
                              const existing = prev.find(i => {
                                  const normalizedDetail = normalizePhone(i.contactDetail);
                                  return normalizedDetail.includes(normalizedContact) || 
                                         normalizedContact.includes(normalizedDetail) ||
                                         normalizedDetail === normalizedContact;
                              });
                              
                              if (existing) {
                                  // STOP Campaign on Reply
                                  CampaignService.stopEnrollment(existing.id);

                                  const newMessage: Message = {
                                      id: msg.messageId,
                                      content: content,
                                      sender: 'importer',
                                      timestamp: msg.timestamp,
                                      channel: Channel.WHATSAPP,
                                      status: MessageStatus.DELIVERED
                                  };
                                  
                                  const updatedImporter = {
                                      ...existing,
                                      status: LeadStatus.ENGAGED,
                                      chatHistory: [...existing.chatHistory, newMessage],
                                      lastContacted: msg.timestamp,
                                      activityLog: [...existing.activityLog, { 
                                          id: `log-${Date.now()}`, 
                                          timestamp: Date.now(), 
                                          type: 'system', 
                                          description: `Incoming WhatsApp message` 
                                      }]
                                  };
                                  
                                  // Auto-response logic with WhatsApp Web support
                                  const autoRespondEnabled = notificationConfig.pushMessages; // Using pushMessages as proxy for auto-respond
                                  const now = Date.now();
                                  const lastResponse = lastAutoResponseTime.current[existing.id] || 0;
                                  
                                  // Check for escalation keywords
                                  const needsEscalation = ESCALATION_KEYWORDS.some(keyword => 
                                      content.toLowerCase().includes(keyword.toLowerCase())
                                  );
                                  
                                  if (autoRespondEnabled && !needsEscalation && user && canSendMessages(user)) {
                                      // Check if using WhatsApp Web and apply appropriate cooldown/limits
                                      // Use async IIFE to handle await
                                      (async () => {
                                          const usingWeb = await isUsingWhatsAppWeb();
                                          const cooldownMs = usingWeb ? AUTO_RESPONSE_COOLDOWN_MS_WEB : AUTO_RESPONSE_COOLDOWN_MS_CLOUD_API;
                                          const canAutoRespond = now - lastResponse > cooldownMs;
                                          
                                          // Additional checks for WhatsApp Web
                                          let webChecksPassed = true;
                                          let webCheckReason = '';
                                          
                                          if (usingWeb) {
                                          // Check daily auto-response limit
                                          const today = new Date().toDateString();
                                          const dailyKey = `${existing.id}-${today}`;
                                          const dailyCount = dailyAutoResponseCount.current[dailyKey] || 0;
                                          
                                          if (dailyCount >= MAX_DAILY_AUTO_RESPONSES_WEB) {
                                              webChecksPassed = false;
                                              webCheckReason = `Daily auto-response limit reached (${MAX_DAILY_AUTO_RESPONSES_WEB} per day)`;
                                          }
                                          
                                          // Check rate limiter
                                          try {
                                              const { WhatsAppWebRateLimiter } = await import('./services/whatsappWebRateLimiter');
                                              const rateLimiter = WhatsAppWebRateLimiter.getInstance();
                                              const rateCheck = await rateLimiter.canSend(existing.contactDetail);
                                              
                                              if (!rateCheck.allowed) {
                                                  webChecksPassed = false;
                                                  webCheckReason = rateCheck.reason || 'Rate limit exceeded';
                                              }
                                          } catch (error) {
                                              console.error("Rate limiter check failed:", error);
                                              // Continue if rate limiter fails
                                          }
                                      }
                                      
                                      if (canAutoRespond && webChecksPassed) {
                                          // Calculate initial delay (longer for WhatsApp Web)
                                          const initialDelay = usingWeb ? 5000 + Math.random() * 5000 : 1000; // 5-10s for Web, 1s for API
                                          
                                          // Trigger auto-response asynchronously
                                          setTimeout(async () => {
                                              try {
                                                  const { generateAgentReply } = await import('./services/geminiService');
                                                  // generateAgentReply now automatically loads company/product data from services
                                                  const reply = await generateAgentReply(
                                                      updatedImporter,
                                                      updatedImporter.chatHistory,
                                                      null,
                                                      templates.agentSystemInstruction,
                                                      Channel.WHATSAPP
                                                  );
                                                  
                                                  if (!reply.startsWith("Error:")) {
                                                      // For WhatsApp Web, check content uniqueness
                                                      if (usingWeb) {
                                                          try {
                                                              const { WhatsAppWebContentChecker } = await import('./services/whatsappWebContentChecker');
                                                              const contentChecker = WhatsAppWebContentChecker.getInstance();
                                                              const contentCheck = contentChecker.checkContent(reply, {
                                                                  name: existing.name,
                                                                  previousMessages: existing.chatHistory.map(m => m.content),
                                                              });
                                                              
                                                              if (!contentCheck.valid) {
                                                                  console.warn("Auto-response blocked by content checker:", contentCheck.reasons);
                                                                  return; // Don't send if content check fails
                                                              }
                                                          } catch (error) {
                                                              console.error("Content checker failed:", error);
                                                              // Continue if content checker fails
                                                          }
                                                      }
                                                      
                                                      // Add typing simulation delay for WhatsApp Web (2-5 seconds)
                                                      if (usingWeb) {
                                                          const typingDelay = 2000 + Math.random() * 3000;
                                                          await new Promise(resolve => setTimeout(resolve, typingDelay));
                                                      }
                                                      
                                                      await sendMessage(updatedImporter, reply, Channel.WHATSAPP);
                                                      lastAutoResponseTime.current[existing.id] = now;
                                                      
                                                      // Update daily count for WhatsApp Web
                                                      if (usingWeb) {
                                                          const today = new Date().toDateString();
                                                          const dailyKey = `${existing.id}-${today}`;
                                                          dailyAutoResponseCount.current[dailyKey] = (dailyAutoResponseCount.current[dailyKey] || 0) + 1;
                                                          
                                                          // Record in rate limiter
                                                          try {
                                                              const { WhatsAppWebRateLimiter } = await import('./services/whatsappWebRateLimiter');
                                                              const rateLimiter = WhatsAppWebRateLimiter.getInstance();
                                                              await rateLimiter.recordSend(existing.contactDetail);
                                                          } catch (error) {
                                                              console.error("Failed to record send in rate limiter:", error);
                                                          }
                                                          
                                                          // Record in content checker
                                                          try {
                                                              const { WhatsAppWebContentChecker } = await import('./services/whatsappWebContentChecker');
                                                              const contentChecker = WhatsAppWebContentChecker.getInstance();
                                                              contentChecker.recordMessage(reply);
                                                          } catch (error) {
                                                              console.error("Failed to record message in content checker:", error);
                                                          }
                                                      }
                                                  }
                                              } catch (error) {
                                                  console.error("Auto-response failed:", error);
                                              }
                                          }, initialDelay);
                                          } else if (!canAutoRespond) {
                                              console.log(`Auto-response skipped: Cooldown not met (${Math.round((cooldownMs - (now - lastResponse)) / 1000)}s remaining)`);
                                          } else if (!webChecksPassed) {
                                              console.log(`Auto-response skipped: ${webCheckReason}`);
                                          }
                                      })();
                                  } else if (needsEscalation) {
                                      updatedImporter.needsHumanReview = true;
                                      updatedImporter.activityLog.push({
                                          id: `log-escalate-${Date.now()}`,
                                          timestamp: Date.now(),
                                          type: 'system',
                                          description: 'Message flagged for human review (escalation keywords detected)'
                                      });
                                  }
                                  
                                  return updatedImporter;
                              } else {
                                  // Create new Pending Lead for unknown contact
                                  const newImporter: Importer = {
                                      id: `new-${Date.now()}`,
                                      name: 'Unknown',
                                      companyName: 'Unknown',
                                      country: 'Unknown',
                                      contactDetail: contact,
                                      productsImported: '',
                                      quantity: '',
                                      priceRange: '',
                                      status: LeadStatus.PENDING,
                                      chatHistory: [{
                                          id: msg.messageId,
                                          content: content,
                                          sender: 'importer',
                                          timestamp: msg.timestamp,
                                          channel: Channel.WHATSAPP,
                                          status: MessageStatus.DELIVERED
                                      }],
                                      activityLog: [{
                                          id: `log-${Date.now()}`,
                                          timestamp: Date.now(),
                                          type: 'system',
                                          description: 'New lead from WhatsApp'
                                      }],
                                      preferredChannel: Channel.WHATSAPP,
                                      channelSelectionMode: 'auto',
                                      validation: { isValid: true, errors: [], checkedAt: Date.now() },
                                      leadScore: 30,
                                      satisfactionIndex: 50
                                  };
                                  return [...prev, newImporter];
                              }
                          });
                      }
                  }
              } else if (channel === 'WeChat') {
                  // WeChat handling - parse XML and process via MessagingService
                  const { MessagingService } = await import('./services/messagingService');
                  
                  if (typeof payload === 'string') {
                      // XML payload from webhook
                      MessagingService.processWeChatWebhook(payload);
                  } else {
                      // Legacy format support
                      const content = payload.Content || payload.content || '';
                      const contact = payload.FromUserName || payload.fromUserName || '';
                      
                      if (content && contact) {
                          setImporters(prev => {
                              const existing = prev.find(i => i.contactDetail.includes(contact) || contact.includes(i.contactDetail));
                              
                              if (existing) {
                                  CampaignService.stopEnrollment(existing.id);
                                  const newMessage: Message = {
                                      id: `wc-${Date.now()}`,
                                      content: content,
                                      sender: 'importer',
                                      timestamp: timestamp || Date.now(),
                                      channel: Channel.WECHAT,
                                      status: MessageStatus.DELIVERED
                                  };
                                  return prev.map(i => i.id === existing.id ? { 
                                      ...i, 
                                      status: LeadStatus.ENGAGED,
                                      chatHistory: [...i.chatHistory, newMessage],
                                      lastContacted: Date.now(),
                                      activityLog: [...i.activityLog, { id: `log-${Date.now()}`, timestamp: Date.now(), type: 'system', description: `Incoming WeChat message` }]
                                  } : i);
                              }
                              return prev;
                          });
                      }
                  }
              }
          });
      }
  }, [user, templates, notificationConfig]);

  useEffect(() => {
    if (!user) return;
    const resetTimer = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    const interval = setInterval(async () => {
        if (user && Date.now() - lastActivity > LOCK_TIMEOUT_MS && !isLocked) {
            // Only lock if PIN is set
            if (user.pinHash) {
                const { PinService } = await import('./services/pinService');
                // Only lock if PIN verification has expired
                if (!PinService.isPinVerified(user.id)) {
                    setIsLocked(true);
                    logSecurityEvent('SESSION_LOCK', user.id, 'Inactivity timeout');
                }
            }
        }
    }, 10000);
    return () => {
        window.removeEventListener('mousemove', resetTimer);
        window.removeEventListener('keydown', resetTimer);
        window.removeEventListener('click', resetTimer);
        clearInterval(interval);
    };
  }, [user, lastActivity, isLocked]);

  // Messaging Listeners
  useEffect(() => {
      MessagingService.onMessageStatusUpdate((messageId, status) => {
          setImporters(prev => prev.map(imp => {
              const msgExists = imp.chatHistory.find(m => m.id === messageId);
              if (msgExists) {
                  return { ...imp, chatHistory: imp.chatHistory.map(m => m.id === messageId ? { ...m, status } : m) };
              }
              return imp;
          }));
      });
      MessagingService.onTypingStatus((importerId, isTyping) => {
        setImporterTypingMap(prev => ({ ...prev, [importerId]: isTyping }));
      });
      MessagingService.onIncomingMessage(async (importerId, contact, content, channel) => {
          const targetId = importerId || selectedId;
          if (targetId) {
              // Stop campaigns
              CampaignService.stopEnrollment(targetId);

              addMessage(targetId, content, 'importer', channel);
              const imp = importers.find(i => i.id === targetId);
              if (imp) {
                  const analysis = await analyzeLeadQuality([...imp.chatHistory, { id: 'temp', content: content, sender: 'importer', timestamp: Date.now(), channel }]);
                  
                  updateImporter(targetId, {
                      status: analysis.status, 
                      conversationSummary: analysis.summary, 
                      nextStep: analysis.nextStep,
                      interestShownIn: analysis.interestShownIn, 
                      needsHumanReview: analysis.requiresHumanReview,
                      leadScore: analysis.leadScore, 
                      satisfactionIndex: analysis.satisfactionIndex,
                      sentimentAnalysis: analysis.sentiment, 
                      detectedEmotions: analysis.emotions    
                  });

                  // CRITICAL ALERT LOGIC
                  if (analysis.sentiment.label === 'Critical' && notificationConfig.criticalAlerts) {
                      // Browser Notification
                      if (Notification.permission === 'granted') {
                          new Notification('Critical Lead Alert', { 
                              body: `${imp.companyName} is exhibiting critical sentiment. Immediate attention required.`,
                              icon: '/assets/icon.png' 
                          });
                      } else if (Notification.permission !== 'denied') {
                           Notification.requestPermission().then(perm => {
                               if (perm === 'granted') {
                                   new Notification('Critical Lead Alert', { 
                                      body: `${imp.companyName} is exhibiting critical sentiment. Immediate attention required.` 
                                  });
                               }
                           });
                      }
                  }
              }
          }
      });
  }, [selectedId, importers, notificationConfig]); 

  // --- Handlers ---

  // Helper function to load all user-specific data
  const loadInitialAppData = async (loggedInUser: User) => {
    const loadTaskId = 'load_app_data';
    try {
      LoadingService.start(loadTaskId, 'Loading user data...');
      
      // Load PIN verifications
      const { PinService } = await import('./services/pinService');
      await PinService.loadPinVerifications();
      
      LoadingService.updateProgress(loadTaskId, 20);
      
      // Check and delete invalid leads after loading data
      setTimeout(() => {
        checkAndDeleteInvalidLeads(loggedInUser);
      }, 500);
      
      // Load platform connections
      const savedPlatforms = await loadPlatformConnections();
      if (savedPlatforms.length > 0) setConnectedPlatforms(savedPlatforms);
      
      LoadingService.updateProgress(loadTaskId, 40);

      // Start token refresh service
      if (isDesktop()) {
        const { TokenRefreshService } = await import('./services/tokenRefreshService');
        const tokenRefreshService = TokenRefreshService.getInstance();
        tokenRefreshService.start();
        console.log('[App] Token refresh service started');
      }
      
      // Load email connection and start ingestion if connected
      const { loadEmailConnection } = await import('./services/securityService');
      const emailConn = await loadEmailConnection();
      if (emailConn) {
        // Add email connection to connected platforms if not already there
        if (!savedPlatforms.find(p => p.channel === Channel.EMAIL)) {
          setConnectedPlatforms([...savedPlatforms, emailConn]);
        }
        
        // Start email ingestion polling
        const { EmailIngestionService } = await import('./services/emailIngestionService');
        const autoReply = await PlatformService.getAppConfig('emailAutoReply', false);
        const draftApproval = await PlatformService.getAppConfig('emailDraftApproval', true);
        
        EmailIngestionService.startPolling({
          enabled: true,
          autoReply,
          draftApprovalRequired: draftApproval,
          pollInterval: 5 * 60 * 1000, // 5 minutes
        });
      }

      LoadingService.updateProgress(loadTaskId, 70);

      // Load user-specific importers/leads
      const savedImporters = await StorageService.loadImporters(loggedInUser.id);
      if (savedImporters && savedImporters.length > 0) {
          setImporters(savedImporters);
      } else {
          setImporters(MOCK_IMPORTERS);
      }

      LoadingService.updateProgress(loadTaskId, 100);
      LoadingService.complete(loadTaskId);
      console.log(`[App] User-specific data loaded for user: ${loggedInUser.id}`);
    } catch (error) {
      LoadingService.stop(loadTaskId);
      console.error('[App] Failed to load initial app data:', error);
    }
  };

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    const sessionSaved = await saveUserSession(loggedInUser);
    if (!sessionSaved) {
      console.warn("[App] Failed to save user session after login");
    }
    logSecurityEvent('LOGIN_SUCCESS', loggedInUser.id, `Role: ${loggedInUser.role}`);
    
    // Load data and proceed to main app
      setIsSetupComplete(true);
      await loadInitialAppData(loggedInUser);
  };

  const handleLogout = () => {
      clearUserSession();
      setUser(null);
  };

  const handlePlatformUpdate = async (newConn: PlatformConnection) => {
    // Handle email connection updates
    if (newConn.channel === Channel.EMAIL) {
      // Start or stop email ingestion based on connection status
      const { EmailIngestionService } = await import('./services/emailIngestionService');
      
      if (newConn.status === PlatformStatus.CONNECTED && newConn.emailCredentials) {
        // Start email ingestion polling
        const autoReply = await PlatformService.getAppConfig('emailAutoReply', false);
        const draftApproval = await PlatformService.getAppConfig('emailDraftApproval', true);
        
        EmailIngestionService.startPolling({
          enabled: true,
          autoReply,
          draftApprovalRequired: draftApproval,
          pollInterval: 5 * 60 * 1000,
        });
      } else {
        // Stop polling if disconnected
        EmailIngestionService.stopPolling();
      }
    }
    
    // Original handlePlatformUpdate logic
      setConnectedPlatforms(prev => {
          const updated = [...prev.filter(p => p.channel !== newConn.channel), newConn];
          savePlatformConnections(updated);
          
          // Refresh MessagingService connections cache
          MessagingService.refreshConnections();
          
          return updated;
      });
  };

  const updateImporter = useCallback((id: string, updates: Partial<Importer>, logDescription?: string) => {
    setImporters(prev => prev.map(imp => {
        if (imp.id === id) {
            const updatedImp = { ...imp, ...updates };
            if (logDescription) {
                updatedImp.activityLog = [...updatedImp.activityLog, { id: `act-${Date.now()}`, timestamp: Date.now(), type: 'status_change', description: logDescription }];
            }
            return updatedImp;
        }
        return imp;
    }));
  }, []);

  const handleMessageFeedback = useCallback((messageId: string, isHelpful: boolean) => {
      setImporters(prev => prev.map(imp => {
          if (!imp.chatHistory.some(m => m.id === messageId)) return imp;
          return {
              ...imp,
              chatHistory: imp.chatHistory.map(m => 
                  m.id === messageId ? { ...m, feedback: isHelpful ? 'helpful' : 'unhelpful' } : m
              )
          };
      }));
  }, []);

  const handleDataRestore = useCallback((restoredImporters: Importer[]) => {
      setImporters(restoredImporters);
      if (restoredImporters.length > 0) setSelectedId(restoredImporters[0].id);
      logSecurityEvent('DATA_RESTORE', user?.id || 'system', `Restored ${restoredImporters.length} records`);
  }, [user?.id]);

  const addMessage = useCallback((importerId: string, content: string, sender: 'agent' | 'importer' | 'system', channelOverride?: Channel, initialStatus?: MessageStatus) => {
    const newMessage: Message = {
      id: Date.now().toString(), content, sender, timestamp: Date.now(), channel: channelOverride || Channel.WHATSAPP, status: initialStatus
    };
    setImporters(prev => prev.map(imp => {
      if (imp.id !== importerId) return imp;
      const logs = [...imp.activityLog];
      if (sender === 'agent') logs.push({ id: `msg-${newMessage.id}`, timestamp: Date.now(), type: 'system', description: `Outbound via ${channelOverride}`});
      else if (sender === 'importer') logs.push({ id: `msg-${newMessage.id}`, timestamp: Date.now(), type: 'system', description: `Inbound via ${channelOverride}`});
      return { ...imp, chatHistory: [...imp.chatHistory, newMessage], activityLog: logs, lastContacted: Date.now() };
    }));
    return newMessage;
  }, []);

  const sendMessage = async (importer: Importer, content: string, channel: Channel) => {
      const msg = addMessage(importer.id, content, 'agent', channel, MessageStatus.SENDING);
      const result = await MessagingService.sendMessage(msg.id, importer.contactDetail, content, channel);
      if (!result.success) {
          setImporters(prev => prev.map(i => i.id === importer.id ? { ...i, chatHistory: i.chatHistory.map(m => m.id === msg.id ? { ...m, status: MessageStatus.FAILED } : m) } : i));
          
          // User-friendly error messages
          let errorMsg = result.error || 'Failed to send message';
          if (channel === Channel.WHATSAPP) {
              if (errorMsg.includes('Rate limit')) {
                  errorMsg = 'WhatsApp rate limit exceeded. Please wait a few minutes before sending more messages.';
              } else if (errorMsg.includes('Invalid') || errorMsg.includes('401')) {
                  errorMsg = 'WhatsApp connection error. Please check your API credentials in Settings → Integrations.';
              } else if (errorMsg.includes('404') || errorMsg.includes('Phone number')) {
                  errorMsg = 'WhatsApp Phone Number ID not found. Please verify your Business account setup.';
              }
          }
          
          alert(`Failed to send: ${errorMsg}`);
      }
      return { success: result.success };
  };

  const handleStartCampaign = async () => {
    if (!user || !canSendMessages(user) || !selectedId) return;
    setIsProcessing(true);
    const importer = importers.find(i => i.id === selectedId);
    if (importer) {
        let channel = importer.preferredChannel;
        if (importer.channelSelectionMode !== 'manual') channel = getOptimalChannel(importer.validation);
        // generateIntroMessage now automatically loads company/product data from services
        const msgText = await generateIntroMessage(importer, null, null, templates.introTemplate, channel);
        if (msgText.startsWith("Error:")) alert(msgText);
        else {
             await sendMessage(importer, msgText, channel);
             updateImporter(selectedId, { status: LeadStatus.CONTACTED, preferredChannel: channel }, `Campaign initiated`);
        }
    }
    setIsProcessing(false);
  };

  const handleAgentReply = async (useStreaming: boolean = false) => {
    if (!user || !canSendMessages(user) || !selectedId) return;
    setIsProcessing(true);
    const importer = importers.find(i => i.id === selectedId);
    if (importer) {
        let channel = importer.preferredChannel;
        if (importer.channelSelectionMode !== 'manual') channel = getOptimalChannel(importer.validation);
        
        if (useStreaming) {
          // Use streaming API for real-time message generation
          try {
            const params = new URLSearchParams({
              importer: encodeURIComponent(JSON.stringify(importer)),
              history: encodeURIComponent(JSON.stringify(importer.chatHistory || [])),
              systemInstructionTemplate: templates.agentSystemInstruction,
              targetChannel: channel,
            });
            
            const response = await fetch(`/api/ai/stream/generate-message?${params}`);
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let partialMessage = '';
            
            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.substring(6));
                      if (data.type === 'chunk') {
                        fullText = data.fullText || '';
                        partialMessage = data.text || '';
                        // TODO: Update UI with partial message (would require state management for streaming messages)
                        // For now, we'll just accumulate the full text
                      } else if (data.type === 'complete') {
                        fullText = data.fullText || '';
                        break;
                      } else if (data.type === 'error') {
                        throw new Error(data.error || 'Streaming error');
                      }
                    } catch (parseError) {
                      // Ignore parse errors for incomplete JSON
                    }
                  }
                }
              }
            }
            
            if (fullText && !fullText.startsWith("Error:")) {
              await sendMessage(importer, fullText, channel);
            } else if (fullText.startsWith("Error:")) {
              alert(fullText);
            }
          } catch (streamError: any) {
            console.error('[App] Streaming error, falling back to non-streaming:', streamError);
            // Fallback to non-streaming
            const reply = await generateAgentReply(importer, importer.chatHistory, null, templates.agentSystemInstruction, channel);
            if (reply.startsWith("Error:")) alert(reply);
            else await sendMessage(importer, reply, channel);
          }
        } else {
          // Non-streaming (default)
          const reply = await generateAgentReply(importer, importer.chatHistory, null, templates.agentSystemInstruction, channel);
          if (reply.startsWith("Error:")) alert(reply);
          else await sendMessage(importer, reply, channel);
        }
    }
    setIsProcessing(false);
  };

  const handleSimulateResponse = async () => {
    if (!selectedId) return;
    const importer = importers.find(i => i.id === selectedId);
    if (importer) {
        const reply = await simulateImporterResponse(importer, importer.chatHistory);
        MessagingService.receiveMockReply(importer.id, reply, importer.preferredChannel);
    }
  };

  const handleManualSend = async (text: string, channel: Channel) => {
    if (!selectedId) return;
    const importer = importers.find(i => i.id === selectedId);
    if (importer) await sendMessage(importer, text, channel);
  };

  // Check and delete invalid leads (wrong phone/email)
  const checkAndDeleteInvalidLeads = useCallback((currentUser?: User | null) => {
    setImportersRaw(prev => {
      const validLeads: Importer[] = [];
      const deletedCount = { count: 0 };
      
      prev.forEach(importer => {
        const validation = validateContactFormat(importer.contactDetail);
        if (validation.isValid) {
          validLeads.push(importer);
        } else {
          deletedCount.count++;
          const userId = currentUser?.id || user?.id || 'system';
          logSecurityEvent('LEAD_DELETED', userId, `Deleted invalid lead: ${importer.name} (${importer.contactDetail}) - ${validation.errors?.join(', ') || 'Invalid format'}`);
        }
      });
      
      if (deletedCount.count > 0) {
        console.log(`[App] Auto-deleted ${deletedCount.count} invalid lead(s)`);
      }
      
      return validLeads;
    });
  }, [user]);

  // Simple import handler - atomic state update, no complexity
  const handleImportComplete = useCallback(async (newItems: Importer[]) => {
    const importTaskId = 'import_leads';
    LoadingService.start(importTaskId, `Importing ${newItems.length} leads...`);
    
    // Simple, direct state update - no guards, no queues, no complexity
    setImportersRaw(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const filtered = newItems.filter(item => !existingIds.has(item.id));
      return [...prev, ...filtered];
    });
    
    LoadingService.updateProgress(importTaskId, 50);
    
    // Get updated state and save to storage
    setImportersRaw(prev => {
      // Save asynchronously after state update completes
      setTimeout(async () => {
        try {
          await StorageService.saveImporters(prev, user?.id);
          LoadingService.complete(importTaskId);
        } catch (error) {
          LoadingService.stop(importTaskId);
        }
      }, 0);
      return prev; // No state change, just trigger save
    });
    
    // After import, check and delete invalid leads
    setTimeout(() => {
      checkAndDeleteInvalidLeads(user);
    }, 100);
  }, [checkAndDeleteInvalidLeads, user]);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = importerListWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartXRef.current;
      const newWidth = Math.max(200, Math.min(600, resizeStartWidthRef.current + deltaX));
      setImporterListWidth(newWidth);
    };

    const handleMouseUp = async () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Save preferences
      if (user) {
        await savePanelSizes({ importerListWidth }, user.id);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, user, importerListWidth]);

  const renderMainView = () => {
      if (activeView === 'campaigns') return (
        <ErrorBoundary>
          <Suspense fallback={<ComponentLoader />}>
            <CampaignManager campaigns={campaigns} onChange={setCampaigns} importers={importers} />
          </Suspense>
        </ErrorBoundary>
      );
      if (activeView === 'calendar') return (
        <ErrorBoundary>
          <Suspense fallback={<ComponentLoader />}>
            <CalendarView events={calendarEvents} onEventClick={(id) => alert(`Event ${id}`)} />
          </Suspense>
        </ErrorBoundary>
      );
      if (activeView === 'products') return (
        <ErrorBoundary>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100" style={{ height: '100%', minHeight: 0, flex: '1 1 0%', overflowY: 'auto' }}>
            <Suspense fallback={<ComponentLoader />}>
              <ProductsCatalogPanel user={user} />
            </Suspense>
          </div>
        </ErrorBoundary>
      );
      
      // Dashboard (Default)
      return (
        <div className="flex-1 flex overflow-hidden p-0 md:p-6 gap-0 bg-slate-100 relative" style={{ width: '100%', maxWidth: '100%', height: '100%', minHeight: '100%', flex: '1 1 auto' }}>
            {/* Importer List Panel - Resizable */}
            <div 
              className={`w-full flex flex-col shadow-sm absolute md:relative top-0 left-0 right-0 bottom-16 md:bottom-0 z-10 md:z-auto bg-slate-100 transition-transform duration-300 ${isMobileView && selectedId ? '-translate-x-full' : 'translate-x-0'} ${isResizing ? '' : 'transition-all'}`}
              style={{ 
                flexShrink: 0,
                width: isMobileView ? '100%' : `${importerListWidth}px`,
                minWidth: isMobileView ? '280px' : '200px',
                maxWidth: isMobileView ? '100%' : '600px'
              }}
            >
                <ImporterList importers={importers} selectedId={selectedId} onSelect={setSelectedId} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} language={language} />
            </div>
            
            {/* Resize Handle - Only visible on desktop */}
            {!isMobileView && (
              <div
                onMouseDown={handleResizeStart}
                className="w-1 bg-slate-300 hover:bg-indigo-500 cursor-col-resize transition-colors z-30 relative"
                style={{ flexShrink: 0 }}
              />
            )}
            
            {/* Chat Interface Panel */}
            <div className={`flex-1 flex flex-col w-full shadow-sm absolute md:relative top-0 left-0 right-0 bottom-16 md:bottom-0 z-20 md:z-auto bg-slate-100 transition-transform duration-300 ${isMobileView && !selectedId ? 'translate-x-full' : 'translate-x-0'}`} style={{ minWidth: 0, flex: '1 1 auto' }}>
                {importers.find(i => i.id === selectedId) ? 
                  <ChatInterface 
                    importer={importers.find(i => i.id === selectedId)!} 
                    isProcessing={isProcessing} 
                    isImporterTyping={selectedId ? importerTypingMap[selectedId] : false} 
                    onSendMessage={handleManualSend} 
                    onSimulateResponse={handleSimulateResponse} 
                    onAutoReply={handleAgentReply} 
                    onBack={() => setSelectedId(null)} 
                    readOnly={!canSendMessages(user!)} 
                    language={language} 
                    onUpdateImporter={updateImporter} 
                    onMessageFeedback={handleMessageFeedback} 
                  /> 
                  : 
                  <div className="hidden md:flex h-full bg-white rounded-xl border border-slate-200 items-center justify-center text-slate-400 shadow-sm">
                    <div className="text-center">
                        <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Select a lead to start automating</p>
                    </div>
                  </div>
                }
            </div>
        </div>
      );
  };

  // --- Rendering ---
  
  // 1. Loading State (Checking Config)
  if (isSetupComplete === null) {
      return (
          <>
            <LoadingBar />
            <div className="h-screen w-screen flex items-center justify-center bg-slate-100" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    <p className="text-slate-500 font-medium">Initializing GlobalReach...</p>
                </div>
            </div>
          </>
      );
  }

  // 2. Login Screen (Show first if not authenticated)
  if (!user) {
      return (
        <>
          <LoadingBar />
          <div className="h-screen w-screen" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}>
            <LoginScreen onLogin={handleLogin} />
          </div>
        </>
      );
  }

  // 3. PIN Lock Screen
  if (user && isLocked) {
    return (
      <>
        <LoadingBar />
        <div className="h-screen w-screen" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}>
          <PinLockScreen
            isLocked={isLocked}
            onUnlock={() => setIsLocked(false)}
            inactivityTimeout={LOCK_TIMEOUT_MS}
          />
        </div>
      </>
    );
  }

  // 5. Owner Admin Panel
  if (user && showOwnerAdmin) {
    if (OwnerAuthService.isOwner(user)) {
      return (
        <>
          <LoadingBar />
          <div className="h-screen w-screen bg-slate-50 overflow-y-auto" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}>
            <div className="max-w-7xl mx-auto p-6">
              <button
                onClick={() => setShowOwnerAdmin(false)}
                className="mb-4 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                ← Back to App
              </button>
              <Suspense fallback={<ComponentLoader />}>
                <OwnerAdminPanel
                  user={user}
                  onSourceCodeAccess={() => setShowSourceCodeViewer(true)}
                />
              </Suspense>
              <SourceCodeViewer
                isOpen={showSourceCodeViewer}
                onClose={() => setShowSourceCodeViewer(false)}
              />
            </div>
          </div>
        </>
      );
    }
  }

  // 5. Main Application
  return (
    <>
      <LoadingBar />
      <div className="flex h-screen w-screen bg-slate-100 text-slate-900 relative overflow-hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0, width: '100vw', height: '100vh', minWidth: '100vw', minHeight: '100vh', maxWidth: '100vw', maxHeight: '100vh', overflow: 'hidden' }}>
          <ErrorBoundary>
            <LeadImportWizard 
              isOpen={showImportModal} 
              onClose={() => setShowImportModal(false)} 
              onComplete={handleImportComplete} 
            />
          </ErrorBoundary>
        {showSettingsModal && (
          <Suspense fallback={<ComponentLoader />}>
            <SettingsModal 
              isOpen={showSettingsModal} 
              onClose={() => setShowSettingsModal(false)} 
              templates={templates} 
              onSave={setTemplates} 
              language={language} 
              setLanguage={setLanguage} 
              userRole={user.role}
              user={user} 
              connectedPlatforms={connectedPlatforms} 
              onUpdateConnection={handlePlatformUpdate} 
              notificationConfig={notificationConfig} 
              onSaveNotifications={setNotificationConfig}
              importers={importers}
              onRestoreData={handleDataRestore}
            />
          </Suspense>
        )}
        <ReportConfigModal isOpen={showReportConfig} onClose={() => setShowReportConfig(false)} config={reportConfig} onSave={setReportConfig} />
        <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
        
        {/* Admin Monitoring Dashboard Modal */}
        {user && showAdminDashboard && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden" style={{ width: '100%', maxWidth: 'min(95vw, 80rem)', height: 'auto', maxHeight: '95vh' }}>
              <div className="flex justify-between items-center p-6 border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800">Admin Monitoring Dashboard</h2>
                <button
                  onClick={() => setShowAdminDashboard(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <Suspense fallback={<ComponentLoader />}>
                  <AdminMonitoringDashboard
                    user={user}
                    importers={importers}
                    onNavigateToSettings={() => {
                      setShowAdminDashboard(false);
                      setShowSettingsModal(true);
                    }}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}

      <Navigation 
        user={user} 
        activeView={activeView}
        setActiveView={setActiveView}
        showAnalytics={showAnalytics} 
        setShowAnalytics={setShowAnalytics} 
        setShowImportModal={setShowImportModal} 
        setShowSettingsModal={setShowSettingsModal}
        setShowHelpModal={setShowHelpModal}
        setShowAdminDashboard={setShowAdminDashboard}
        setShowOwnerAdmin={setShowOwnerAdmin}
        onLogout={handleLogout} 
        language={language} 
      />
      <ErrorBoundary>
        <div className={`fixed md:absolute top-0 bottom-16 md:bottom-0 left-0 md:left-20 w-full md:w-96 bg-white border-r border-slate-200 shadow-2xl z-40 transition-transform duration-300 ${showAnalytics ? 'translate-x-0' : '-translate-x-[120%] md:-translate-x-full'}`}>
          <Suspense fallback={<ComponentLoader type="analytics" />}>
            <AnalyticsDashboard importers={importers} forecastData={forecastData} reportConfig={reportConfig} onDrillDown={setStatusFilter} onGenerateForecast={async () => { setIsForecasting(true); setForecastData(await generateSalesForecast(importers)); setIsForecasting(false); }} onConfigure={() => setShowReportConfig(true)} onClose={() => setShowAnalytics(false)} isForecasting={isForecasting} />
          </Suspense>
        </div>
      </ErrorBoundary>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 ml-0 relative z-0" style={{ width: '100%', maxWidth: '100%', height: '100%', minHeight: 0, flex: '1 1 0%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <header className="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-6 shrink-0 shadow-sm z-10 hidden md:flex" style={{ flexShrink: 0 }}>
            <h1 className="text-xl font-bold text-slate-800">GlobalReach <span className="text-indigo-600 font-light">Automator</span></h1>
            <div className="flex gap-3 items-center">
                <span className="text-sm text-slate-500 mr-2">{t('welcome', language)}, {user.name}</span>
                {canSendMessages(user) && <button onClick={handleStartCampaign} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"><Play className="w-4 h-4" /> {t('campaign', language)}</button>}
                {canExportData(user) && <button onClick={() => alert("Export")} className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-all"><Download className="w-4 h-4" /> {t('export', language)}</button>}
            </div>
        </header>
        <header className="md:hidden h-14 bg-white border-b border-slate-200 flex justify-between items-center px-4 shrink-0 z-10" style={{ flexShrink: 0 }}>
             <h1 className="text-lg font-bold text-slate-800">GlobalReach</h1>
             {canSendMessages(user) && !selectedId && <button onClick={handleStartCampaign} className="p-2 bg-slate-900 text-white rounded-lg"><Play className="w-4 h-4" /></button>}
        </header>
        
        <div className="flex-1 overflow-hidden min-h-0" style={{ flex: '1 1 0%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ErrorBoundary>
            {renderMainView()}
          </ErrorBoundary>
        </div>

      </div>
    </div>
    </>
  );
};

export default App;