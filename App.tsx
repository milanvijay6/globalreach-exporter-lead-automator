
import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, Play, Zap, LayoutDashboard, Lock, Loader2 } from 'lucide-react';
import ImporterList from './components/ImporterList';
import ChatInterface from './components/ChatInterface';
import BulkImportModal from './components/BulkImportModal';
import SettingsModal from './components/SettingsModal';
import ReportConfigModal from './components/ReportConfigModal';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LoginScreen from './components/LoginScreen';
import Navigation from './components/Navigation';
import SetupWizard from './components/SetupWizard';
import HelpModal from './components/HelpModal';
import CampaignManager from './components/CampaignManager';
import CalendarView from './components/CalendarView';

import { Importer, LeadStatus, Message, Channel, AppTemplates, DEFAULT_TEMPLATES, ReportConfig, SalesForecast, User, Language, canExportData, canSendMessages, PlatformConnection, MessageStatus, NotificationConfig, DEFAULT_NOTIFICATIONS, Campaign, CalendarEvent } from './types';
import { generateIntroMessage, generateAgentReply, analyzeLeadQuality, simulateImporterResponse, generateSalesForecast } from './services/geminiService';
import { simulateNetworkValidation, getOptimalChannel } from './services/validationService';
import { logSecurityEvent, loadUserSession, saveUserSession, clearUserSession, loadPlatformConnections, savePlatformConnections, refreshPlatformTokens } from './services/securityService';
import { MessagingService } from './services/messagingService';
import { StorageService } from './services/storageService';
import { CampaignService } from './services/campaignService';
import { CalendarService } from './services/calendarService';
import { t } from './services/i18n';
import { isDesktop, PlatformService } from './services/platformService';

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
    chatHistory: [{id: 'm1', content: 'Hi', sender: 'agent', timestamp: Date.now(), channel: Channel.EMAIL, status: MessageStatus.READ}],
    activityLog: [{id: 'log2', timestamp: Date.now() - 200000, type: 'system', description: 'Lead imported'}],
    preferredChannel: Channel.EMAIL,
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
    emailRecipients: ''
};

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [connectedPlatforms, setConnectedPlatforms] = useState<PlatformConnection[]>([]);
  const [importers, setImporters] = useState<Importer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importerTypingMap, setImporterTypingMap] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'campaigns' | 'calendar'>('dashboard');
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showReportConfig, setShowReportConfig] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [templates, setTemplates] = useState<AppTemplates>(DEFAULT_TEMPLATES);
  const [reportConfig, setReportConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATIONS);
  const [language, setLanguage] = useState<Language>('en');
  const [forecastData, setForecastData] = useState<SalesForecast[] | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // isSetupComplete is null initially to represent "loading" state
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  // Campaigns & Calendar
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // --- Effects ---

  useEffect(() => {
    const init = async () => {
        try {
            // Check configuration first
            const setupStatus = await PlatformService.getAppConfig('setupComplete', false);
            console.log("[App] Loaded Setup Status:", setupStatus);
            setIsSetupComplete(setupStatus === true);

            // If setup is complete, load other data
            if (setupStatus === true) {
                const savedUser = await loadUserSession();
                if (savedUser) {
                    setUser(savedUser);
                    logSecurityEvent('SESSION_RESTORE', savedUser.id, 'Restored from secure storage');
                }
                const savedPlatforms = await loadPlatformConnections();
                if (savedPlatforms.length > 0) setConnectedPlatforms(savedPlatforms);

                const savedImporters = StorageService.loadImporters();
                if (savedImporters && savedImporters.length > 0) {
                    setImporters(savedImporters);
                } else {
                    setImporters(MOCK_IMPORTERS);
                }
            }
        } catch (e) {
            console.error("Initialization failed", e);
            setIsSetupComplete(false); // Default to running setup if error
        }
    };
    init();
  }, []);

  useEffect(() => {
      // Background Token Refresh Loop
      const interval = setInterval(async () => {
          if (user && connectedPlatforms.length > 0) {
              const refreshed = await refreshPlatformTokens(connectedPlatforms);
              setConnectedPlatforms(refreshed);
          }
      }, 5 * 60 * 1000); // Every 5 minutes
      return () => clearInterval(interval);
  }, [user, connectedPlatforms]);

  useEffect(() => {
    if (importers.length > 0) StorageService.saveImporters(importers);
  }, [importers]);

  // Email Ingestion Setup
  useEffect(() => {
    const setupEmailIngestion = async () => {
      const { EmailIngestionService } = await import('./services/emailIngestionService');
      const { EmailClassificationService } = await import('./services/emailClassificationService');
      const { EmailAutoReplyService } = await import('./services/emailAutoReplyService');
      const { EmailRoutingService } = await import('./services/emailRoutingService');
      const { EmailConversionService } = await import('./services/emailConversionService');
      
      // Register email ingestion callback
      EmailIngestionService.onEmailReceived(async (message) => {
        try {
          // Quick spam check
          if (EmailClassificationService.isLikelySpam(message)) {
            console.log('[App] Spam email detected, ignoring:', message.from.email);
            return;
          }
          
          // Classify email
          const classification = await EmailClassificationService.classifyEmail(message);
          
          // Route email
          const routing = EmailRoutingService.routeEmail(message, classification);
          
          // Find or create importer
          const emailAddress = message.from.email.toLowerCase();
          const currentImporters = importers; // Capture current state
          let importer = currentImporters.find(i => 
            i.contactDetail.toLowerCase() === emailAddress
          );
          
          const newMessage: Message = {
            id: message.id,
            content: message.body.text || message.body.html?.replace(/<[^>]*>/g, '') || '',
            sender: 'importer',
            timestamp: message.date.getTime(),
            channel: Channel.EMAIL,
            status: MessageStatus.DELIVERED,
          };
          
          if (!importer) {
            // Create new importer from email
            const newImporter: Importer = {
              id: `email-${Date.now()}`,
              name: message.from.name || emailAddress.split('@')[0],
              companyName: classification.extractedData.companyName || 'Unknown',
              country: 'Unknown',
              contactDetail: emailAddress,
              productsImported: classification.topics.join(', ') || '',
              quantity: classification.extractedData.quantities || '',
              priceRange: '',
              status: EmailClassificationService.classificationToLeadStatus(classification),
              chatHistory: [newMessage],
              activityLog: [{
                id: `log-${Date.now()}`,
                timestamp: Date.now(),
                type: 'system',
                description: `Incoming email: ${classification.category}`
              }],
              preferredChannel: Channel.EMAIL,
              channelSelectionMode: 'auto',
              validation: { isValid: true, errors: [], checkedAt: Date.now(), emailMxValid: true },
              leadScore: classification.leadScore,
              satisfactionIndex: 50,
              sentimentAnalysis: classification.sentiment,
              detectedEmotions: classification.emotions,
              needsHumanReview: classification.requiresHumanReview,
            };
            
            setImporters(prev => [...prev, newImporter]);
            importer = newImporter;
          } else {
            // Add message to existing importer
            setImporters(prev => prev.map(i => 
              i.id === importer!.id 
                ? { 
                    ...i, 
                    chatHistory: [...i.chatHistory, newMessage],
                    lastContacted: message.date.getTime(),
                    status: EmailClassificationService.classificationToLeadStatus(classification),
                    leadScore: classification.leadScore,
                    sentimentAnalysis: classification.sentiment,
                    detectedEmotions: classification.emotions,
                    needsHumanReview: classification.requiresHumanReview || i.needsHumanReview,
                  }
                : i
            ));
            // Update importer reference
            importer = {
              ...importer,
              chatHistory: [...importer.chatHistory, newMessage],
              lastContacted: message.date.getTime(),
              status: EmailClassificationService.classificationToLeadStatus(classification),
              leadScore: classification.leadScore,
              sentimentAnalysis: classification.sentiment,
              detectedEmotions: classification.emotions,
              needsHumanReview: classification.requiresHumanReview || importer.needsHumanReview,
            };
          }
          
          // Auto-reply if appropriate
          if (routing.route === 'sales' && !classification.requiresHumanReview && user && canSendMessages(user.role)) {
            const shouldReply = EmailAutoReplyService.shouldAutoReply(message, classification);
            if (shouldReply.shouldReply) {
              setTimeout(async () => {
                // Use the importer we just created/updated (captured in closure)
                if (importer) {
                  const replyResult = await EmailAutoReplyService.sendAutoReply(
                    message,
                    classification,
                    importer,
                    templates,
                    importer.chatHistory,
                    { requireApproval: false }
                  );
                  if (replyResult.success) {
                    console.log('[App] Auto-reply sent to', emailAddress);
                  }
                }
              }, 2000); // Wait for state to update
            }
          }
          
          // Check for conversion workflows
          if (classification.leadScore >= 60 && importer) {
            setTimeout(async () => {
              const conversionResult = await EmailConversionService.checkAndTriggerConversion(
                importer,
                classification,
                [message], // Email history
                EmailConversionService.getDefaultWorkflows(),
                templates
              );
              if (conversionResult.triggered) {
                console.log('[App] Conversion workflow triggered:', conversionResult.workflowId);
              }
            }, 1000);
          }
        } catch (error) {
          console.error('[App] Email processing error:', error);
        }
      });
      
      // Initialize email ingestion
      await EmailIngestionService.initialize();
    };
    
    if (isSetupComplete && user) {
      setupEmailIngestion();
    }
    
    return () => {
      // Cleanup on unmount
      import('./services/emailIngestionService').then(({ EmailIngestionService }) => {
        EmailIngestionService.shutdown();
      });
    };
  }, [isSetupComplete, user, importers, templates]);

  // Campaign Heartbeat
  useEffect(() => {
      const interval = setInterval(async () => {
          const { importers: updatedImporters, events: newEvents } = await CampaignService.processCampaigns(
              importers, 
              campaigns, 
              templates, 
              (imp, msg, ch) => sendMessage(imp, msg, ch)
          );
          
          if (updatedImporters) setImporters(updatedImporters);
          if (newEvents.length > 0) setCalendarEvents(prev => [...prev, ...newEvents]);

      }, 60000); // Check every minute
      return () => clearInterval(interval);
  }, [importers, campaigns, templates]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile && !selectedId && importers.length > 0) setSelectedId(importers[0].id);
  }, [isMobile, importers, selectedId]);

  // Auto-response rate limiting (per conversation)
  const lastAutoResponseTime = useRef<Record<string, number>>({});
  const AUTO_RESPONSE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
  const ESCALATION_KEYWORDS = ['manager', 'human', 'help', 'support', 'complaint', 'urgent', 'problem'];

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
                                  
                                  // Auto-response logic
                                  const autoRespondEnabled = notificationConfig.pushMessages; // Using pushMessages as proxy for auto-respond
                                  const now = Date.now();
                                  const lastResponse = lastAutoResponseTime.current[existing.id] || 0;
                                  const canAutoRespond = now - lastResponse > AUTO_RESPONSE_COOLDOWN_MS;
                                  
                                  // Check for escalation keywords
                                  const needsEscalation = ESCALATION_KEYWORDS.some(keyword => 
                                      content.toLowerCase().includes(keyword.toLowerCase())
                                  );
                                  
                                  if (autoRespondEnabled && canAutoRespond && !needsEscalation && user && canSendMessages(user.role)) {
                                      // Trigger auto-response asynchronously
                                      setTimeout(async () => {
                                          try {
                                              const { generateAgentReply } = await import('./services/geminiService');
                                              const reply = await generateAgentReply(
                                                  updatedImporter,
                                                  updatedImporter.chatHistory,
                                                  "Global Exports",
                                                  templates.agentSystemInstruction,
                                                  Channel.WHATSAPP
                                              );
                                              
                                              if (!reply.startsWith("Error:")) {
                                                  await sendMessage(updatedImporter, reply, Channel.WHATSAPP);
                                                  lastAutoResponseTime.current[existing.id] = now;
                                              }
                                          } catch (error) {
                                              console.error("Auto-response failed:", error);
                                          }
                                      }, 1000);
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
    const interval = setInterval(() => {
        if (Date.now() - lastActivity > LOCK_TIMEOUT_MS && !isLocked) {
            setIsLocked(true);
            logSecurityEvent('SESSION_LOCK', user.id, 'Inactivity timeout');
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

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    saveUserSession(loggedInUser);
    logSecurityEvent('LOGIN_SUCCESS', loggedInUser.id, `Role: ${loggedInUser.role}`);
  };

  const handleLogout = () => {
      clearUserSession();
      setUser(null);
  };

  const handlePlatformUpdate = async (newConn: PlatformConnection) => {
      setConnectedPlatforms(prev => {
          const updated = [...prev.filter(p => p.channel !== newConn.channel), newConn];
          savePlatformConnections(updated);
          
          // Refresh MessagingService connections cache
          MessagingService.refreshConnections();
          
          return updated;
      });
  };

  const updateImporter = (id: string, updates: Partial<Importer>, logDescription?: string) => {
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
  };

  const handleMessageFeedback = (messageId: string, isHelpful: boolean) => {
      setImporters(prev => prev.map(imp => {
          if (!imp.chatHistory.some(m => m.id === messageId)) return imp;
          return {
              ...imp,
              chatHistory: imp.chatHistory.map(m => 
                  m.id === messageId ? { ...m, feedback: isHelpful ? 'helpful' : 'unhelpful' } : m
              )
          };
      }));
  };

  const handleDataRestore = (restoredImporters: Importer[]) => {
      setImporters(restoredImporters);
      if (restoredImporters.length > 0) setSelectedId(restoredImporters[0].id);
      logSecurityEvent('DATA_RESTORE', user?.id || 'system', `Restored ${restoredImporters.length} records`);
  };

  const addMessage = (importerId: string, content: string, sender: 'agent' | 'importer' | 'system', channelOverride?: Channel, initialStatus?: MessageStatus) => {
    const newMessage: Message = {
      id: Date.now().toString(), content, sender, timestamp: Date.now(), channel: channelOverride || Channel.EMAIL, status: initialStatus
    };
    setImporters(prev => prev.map(imp => {
      if (imp.id !== importerId) return imp;
      const logs = [...imp.activityLog];
      if (sender === 'agent') logs.push({ id: `msg-${newMessage.id}`, timestamp: Date.now(), type: 'system', description: `Outbound via ${channelOverride}`});
      else if (sender === 'importer') logs.push({ id: `msg-${newMessage.id}`, timestamp: Date.now(), type: 'system', description: `Inbound via ${channelOverride}`});
      return { ...imp, chatHistory: [...imp.chatHistory, newMessage], activityLog: logs, lastContacted: Date.now() };
    }));
    return newMessage;
  };

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
    if (!user || !canSendMessages(user.role) || !selectedId) return;
    setIsProcessing(true);
    const importer = importers.find(i => i.id === selectedId);
    if (importer) {
        let channel = importer.preferredChannel;
        if (importer.channelSelectionMode !== 'manual') channel = getOptimalChannel(importer.validation);
        const msgText = await generateIntroMessage(importer, "Global Exports", "Agri-Products", templates.introTemplate, channel);
        if (msgText.startsWith("Error:")) alert(msgText);
        else {
             await sendMessage(importer, msgText, channel);
             updateImporter(selectedId, { status: LeadStatus.CONTACTED, preferredChannel: channel }, `Campaign initiated`);
        }
    }
    setIsProcessing(false);
  };

  const handleAgentReply = async () => {
    if (!user || !canSendMessages(user.role) || !selectedId) return;
    setIsProcessing(true);
    const importer = importers.find(i => i.id === selectedId);
    if (importer) {
        let channel = importer.preferredChannel;
        if (importer.channelSelectionMode !== 'manual') channel = getOptimalChannel(importer.validation);
        const reply = await generateAgentReply(importer, importer.chatHistory, "Global Exports", templates.agentSystemInstruction, channel);
        if (reply.startsWith("Error:")) alert(reply);
        else await sendMessage(importer, reply, channel);
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

  const renderMainView = () => {
      if (activeView === 'campaigns') return <CampaignManager campaigns={campaigns} onChange={setCampaigns} importers={importers} />;
      if (activeView === 'calendar') return <CalendarView events={calendarEvents} onEventClick={(id) => alert(`Event ${id}`)} />;
      
      // Dashboard (Default)
      return (
        <div className="flex-1 flex overflow-hidden p-0 md:p-6 gap-6 bg-slate-100 relative h-full">
            {/* Importer List Panel - Slide Logic */}
            <div className={`w-full md:w-1/3 flex flex-col min-w-[320px] max-w-full md:max-w-[450px] shadow-sm absolute md:relative top-0 left-0 right-0 bottom-16 md:bottom-0 z-10 md:z-auto bg-slate-100 transition-transform duration-300 ${isMobile && selectedId ? '-translate-x-full' : 'translate-x-0'}`}>
                <ImporterList importers={importers} selectedId={selectedId} onSelect={setSelectedId} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} language={language} />
            </div>
            
            {/* Chat Interface Panel - Slide Logic */}
            <div className={`flex-1 flex flex-col w-full shadow-sm absolute md:relative top-0 left-0 right-0 bottom-16 md:bottom-0 z-20 md:z-auto bg-slate-100 transition-transform duration-300 ${isMobile && !selectedId ? 'translate-x-full' : 'translate-x-0'}`}>
                {importers.find(i => i.id === selectedId) ? 
                  <ChatInterface 
                    importer={importers.find(i => i.id === selectedId)!} 
                    isProcessing={isProcessing} 
                    isImporterTyping={selectedId ? importerTypingMap[selectedId] : false} 
                    onSendMessage={handleManualSend} 
                    onSimulateResponse={handleSimulateResponse} 
                    onAutoReply={handleAgentReply} 
                    onBack={() => setSelectedId(null)} 
                    readOnly={!canSendMessages(user!.role)} 
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
          <div className="h-full w-full flex items-center justify-center bg-slate-100">
              <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                  <p className="text-slate-500 font-medium">Initializing GlobalReach...</p>
              </div>
          </div>
      );
  }

  // 2. Setup Wizard (First Run)
  if (!isSetupComplete) {
      return <SetupWizard onComplete={() => setIsSetupComplete(true)} />;
  }

  // 3. Login Screen (Not Authenticated)
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  // 4. Locked State (Security Timeout)
  if (isLocked) {
      return (
          <div className="fixed inset-0 bg-slate-900 z-[200] flex flex-col items-center justify-center text-white">
              <Lock className="w-12 h-12 mb-4 text-red-500" />
              <h2 className="text-xl font-bold mb-6">Session Locked</h2>
              <button onClick={() => { setIsLocked(false); setLastActivity(Date.now()); }} className="px-6 py-2 bg-indigo-600 rounded-lg">Resume</button>
          </div>
      );
  }

  // 5. Main Application
  return (
    <div className="flex h-full w-full bg-slate-100 text-slate-900 relative overflow-hidden">
        <BulkImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={(newItems) => setImporters(prev => [...prev, ...newItems])} />
        <SettingsModal 
            isOpen={showSettingsModal} 
            onClose={() => setShowSettingsModal(false)} 
            templates={templates} 
            onSave={setTemplates} 
            language={language} 
            setLanguage={setLanguage} 
            userRole={user.role} 
            connectedPlatforms={connectedPlatforms} 
            onUpdateConnection={handlePlatformUpdate} 
            notificationConfig={notificationConfig} 
            onSaveNotifications={setNotificationConfig}
            importers={importers}
            onRestoreData={handleDataRestore}
        />
        <ReportConfigModal isOpen={showReportConfig} onClose={() => setShowReportConfig(false)} config={reportConfig} onSave={setReportConfig} />
        <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

      <Navigation 
        user={user} 
        activeView={activeView}
        setActiveView={setActiveView}
        showAnalytics={showAnalytics} 
        setShowAnalytics={setShowAnalytics} 
        setShowImportModal={setShowImportModal} 
        setShowSettingsModal={setShowSettingsModal}
        setShowHelpModal={setShowHelpModal} 
        onLogout={handleLogout} 
        language={language} 
      />
      <div className={`fixed md:absolute top-0 bottom-16 md:bottom-0 left-0 md:left-20 w-full md:w-96 bg-white border-r border-slate-200 shadow-2xl z-40 transition-transform duration-300 ${showAnalytics ? 'translate-x-0' : '-translate-x-[120%] md:-translate-x-full'}`}>
         <AnalyticsDashboard importers={importers} forecastData={forecastData} reportConfig={reportConfig} onDrillDown={setStatusFilter} onGenerateForecast={async () => { setIsForecasting(true); setForecastData(await generateSalesForecast(importers)); setIsForecasting(false); }} onConfigure={() => setShowReportConfig(true)} onClose={() => setShowAnalytics(false)} isForecasting={isForecasting} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 ml-0 relative z-0">
        <header className="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-6 shrink-0 shadow-sm z-10 hidden md:flex">
            <h1 className="text-xl font-bold text-slate-800">GlobalReach <span className="text-indigo-600 font-light">Automator</span></h1>
            <div className="flex gap-3 items-center">
                <span className="text-sm text-slate-500 mr-2">{t('welcome', language)}, {user.name}</span>
                {canSendMessages(user.role) && <button onClick={handleStartCampaign} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"><Play className="w-4 h-4" /> {t('campaign', language)}</button>}
                {canExportData(user.role) && <button onClick={() => alert("Export")} className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-all"><Download className="w-4 h-4" /> {t('export', language)}</button>}
            </div>
        </header>
        <header className="md:hidden h-14 bg-white border-b border-slate-200 flex justify-between items-center px-4 shrink-0 z-10">
             <h1 className="text-lg font-bold text-slate-800">GlobalReach</h1>
             {canSendMessages(user.role) && !selectedId && <button onClick={handleStartCampaign} className="p-2 bg-slate-900 text-white rounded-lg"><Play className="w-4 h-4" /></button>}
        </header>
        
        {renderMainView()}

      </div>
    </div>
  );
};

export default App;
