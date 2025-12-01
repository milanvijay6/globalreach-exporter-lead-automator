
export enum Channel {
  WHATSAPP = 'WhatsApp',
  WECHAT = 'WeChat',
  SMS = 'SMS',
  EMAIL = 'Email',
}

export enum LeadStatus {
  PENDING = 'Pending', // Not contacted
  CONTACTED = 'Contacted', // Initial message sent
  ENGAGED = 'Engaged', // Reply received
  INTERESTED = 'Interested', // Qualified lead
  NEGOTIATION = 'Negotiation',
  SAMPLE_SENT = 'Sample Sent',
  CLOSED = 'Closed', // Deal done or lost
  COLD = 'Cold', // Not interested
}

export enum UserRole {
  OWNER = 'Owner',
  ADMIN = 'Admin',
  SALES = 'Sales',
  VIEWER = 'Viewer'
}

export enum Permission {
  READ = 'READ',
  WRITE = 'WRITE',
  DELETE = 'DELETE',
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  API_KEY_MANAGE = 'API_KEY_MANAGE',
  SETTINGS_MANAGE = 'SETTINGS_MANAGE',
  DATA_EXPORT = 'DATA_EXPORT',
  AUDIT_VIEW = 'AUDIT_VIEW',
  COMPANY_CONFIG_MANAGE = 'COMPANY_CONFIG_MANAGE'
}

export enum PlatformStatus {
  DISCONNECTED = 'Disconnected',
  CONNECTING = 'Connecting',
  CONNECTED = 'Connected',
  ERROR = 'Error'
}

export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',       // Server acknowledged
  DELIVERED = 'delivered', // Recipient device received
  READ = 'read',       // Recipient opened
  FAILED = 'failed'
}

export enum AuthStep {
  IDLE = 'idle',
  INITIATING = 'initiating',
  AUTHENTICATING = 'authenticating',
  EXCHANGING = 'exchanging',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface AuthError {
  code: string;
  message: string;
  retryable: boolean;
  details?: any;
}

export interface AuthState {
  status: AuthStep;
  provider?: 'gmail' | 'outlook' | 'custom';
  step: AuthStep;
  error?: AuthError;
  timestamp: number;
  email?: string;
  method?: 'oauth' | 'magic-link' | 'imap' | 'smtp';
}

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
}

export interface OutlookEmailCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  userEmail: string;
  tenantId?: string;
}

export interface WeChatCredentials {
  appId: string;
  appSecret: string; // Encrypted
  accessToken?: string;
  accessTokenExpiry?: number;
  refreshToken?: string; // For OAuth user tokens
  webhookToken?: string; // For webhook verification
  encodingAESKey?: string; // For message encryption (optional)
}

export interface PlatformConnection {
  channel: Channel;
  status: PlatformStatus;
  accountName?: string; // e.g., +1 (555) 123-4567 or user@example.com
  connectedAt?: number;
  provider?: 'whatsapp' | 'wechat' | 'outlook';
  lastTested?: number;
  healthStatus?: 'healthy' | 'error';
  whatsappCredentials?: WhatsAppCredentials;
  wechatCredentials?: WeChatCredentials;
  emailCredentials?: OutlookEmailCredentials;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
  permissions?: Permission[];
  mfaEnabled?: boolean;
  mfaSecret?: string; // Encrypted
  lastMfaVerified?: number;
  email: string; // Login ID
  mobile?: string;
  passwordHash: string; // Hashed password (never plain text)
  pinHash?: string; // Hashed 4-digit PIN
  status: 'pending' | 'active' | 'rejected' | 'suspended';
  approvedBy?: string; // User ID who approved
  approvedAt?: number;
  createdBy?: string; // User ID who created (for admin-created users)
  createdAt: number;
  lastLogin?: number;
  failedLoginAttempts?: number;
  lockoutUntil?: number;
}

export interface PendingUser {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  requestedRole: UserRole;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

export interface OwnerCredentials {
  email: string;
  passwordHash: string; // Stored in encrypted config + env
}

export interface PinVerification {
  userId: string;
  verifiedAt: number;
  expiresAt: number;
}

export interface AuthSession {
  id: string;
  userId: string;
  device: string;
  ip: string;
  lastActive: number;
  isCurrent: boolean;
}

export type Language = 'en' | 'es' | 'zh';
export type SentimentLabel = 'Positive' | 'Neutral' | 'Negative' | 'Critical';
export type EmotionLabel = 'Frustration' | 'Confusion' | 'Enthusiasm' | 'Urgency' | 'Skepticism' | 'Gratitude';

export interface SentimentData {
  label: SentimentLabel;
  score: number;      // -1.0 (Negative) to 1.0 (Positive)
  intensity: number;  // 0.0 (Weak) to 1.0 (Strong)
}

export interface EmotionData {
  label: EmotionLabel;
  confidence: number; // 0.0 to 1.0
}

export interface Message {
  id: string;
  sender: 'agent' | 'importer' | 'system';
  content: string;
  timestamp: number;
  channel: Channel;
  status?: MessageStatus;
  sentiment?: SentimentData; // Granular sentiment per message
  feedback?: 'helpful' | 'unhelpful'; // User feedback for AI optimization
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  type: 'status_change' | 'note' | 'validation' | 'system';
  description: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  emailMxValid?: boolean | null; // null = checking, true = valid, false = invalid
  whatsappAvailable?: boolean | null;
  wechatAvailable?: boolean | null;
  checkedAt: number;
}

export interface Importer {
  id: string;
  name: string;
  companyName: string;
  country: string;
  contactDetail: string; // Phone or Email (kept for backward compatibility)
  email?: string; // Separate email field
  phone?: string; // Separate phone field
  primaryContact?: 'phone' | 'email' | null; // Default: phone if available, else email
  productsImported: string;
  quantity: string;
  priceRange: string;
  
  // Computed/AI Updated Fields
  interestShownIn?: string;
  conversationSummary?: string;
  nextStep?: string;
  status: LeadStatus;
  chatHistory: Message[];
  activityLog: ActivityLogEntry[];
  
  // Channel Preferences
  preferredChannel: Channel;
  channelSelectionMode?: 'auto' | 'manual';

  needsHumanReview?: boolean; // New: Escalation flag
  
  // Intelligent Insights & Scoring
  leadScore?: number; // 0-100 (Buying Likelihood)
  satisfactionIndex?: number; // 0-100 (Overall Happiness)
  
  sentimentAnalysis?: SentimentData;
  detectedEmotions?: EmotionData[];

  // Validation & Metadata
  validation: ValidationResult;
  lastContacted?: number;
}

export interface AnalysisResult {
  status: LeadStatus;
  summary: string;
  nextStep: string;
  interestShownIn: string;
  requiresHumanReview: boolean;
  leadScore: number; // Buying Intent
  satisfactionIndex: number; // Relationship Health
  sentiment: SentimentData;
  emotions: EmotionData[];
}

export interface DashboardStats {
  total: number;
  contacted: number;
  interested: number;
  conversionRate: number;
}

export interface AppTemplates {
  introTemplate: string;
  agentSystemInstruction: string;
}

export interface NotificationConfig {
  emailQualified: boolean; // Email user when lead becomes Interested
  pushMessages: boolean;   // Browser push for new inbound messages
  dailyDigest: boolean;    // Daily summary email
  criticalAlerts: boolean; // Alert on Critical sentiment
}

export interface ReportConfig {
  timeFrame: '7d' | '30d' | '90d' | 'all';
  kpis: {
    revenue: boolean;
    conversion: boolean;
    leads: boolean;
  };
  exportSchedule: 'daily' | 'weekly' | 'monthly' | 'never';
  emailRecipients: string;
}

export interface SalesForecast {
  date: string;
  predictedConversions: number;
  confidence: number; // 0-1
}

export interface WebhookConfig {
  webhookToken: string;
  tunnelUrl?: string;
}

export interface Campaign {
  id: string;
  name: string;
  steps: CampaignStep[];
  status: 'active' | 'paused' | 'draft';
  createdAt: number;
}

export interface CampaignStep {
  id: string;
  dayOffset: number; // Days after enrollment
  channel: Channel;
  template: string; // With placeholders
}

export interface Enrollment {
  importerId: string;
  campaignId: string;
  currentStepIndex: number; // 0 = waiting for step 0
  nextRunTime: number; // Timestamp
  status: 'active' | 'completed' | 'stopped';
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  importerId?: string;
  type: 'follow_up' | 'meeting' | 'campaign_step';
  status: 'pending' | 'done';
}

export interface OptimizationInsight {
    strengths: string[];
    weaknesses: string[];
    suggestedIntro: string;
    suggestedSystemInstruction: string;
    reasoning: string;
}

export interface MessageFeedback {
    messageId: string;
    isHelpful: boolean;
}

export interface StrategicInsight {
    id: string;
    type: 'pattern' | 'correlation' | 'snippet';
    category: 'positive' | 'negative' | 'neutral';
    title: string;
    description: string;
    impactScore?: number; // 0-100 impact on sales
    dataPoints?: string[]; // Snippets or stats
}

export interface TrainingModule {
  id: string;
  title: string;
  focusArea: 'Empathy' | 'Technique' | 'Intervention';
  description: string;
  scenarios: {
    situation: string;
    poorResponse: string;
    betterResponse: string;
    explanation: string;
  }[];
  suggestedPhrases: string[];
  toneAdjustments: string[];
}

export interface CoachingTip {
  id: string;
  type: 'alert' | 'suggestion' | 'praise';
  title: string;
  message: string;
  actionable?: string;
}

// Default Templates
export const DEFAULT_TEMPLATES: AppTemplates = {
  introTemplate: `Hello {{importerName}},
I noticed from your import profile that you are working with {{productCategory}}.
We supply high-quality {{myProduct}} that match the specifications typically required in your market.

We can offer:
Product: {{myProduct}}
Quality: High Grade
Capacity: Large Volume Available
Price Range: Competitive International Standards

If you are currently exploring suppliers, I would be happy to share details and samples.
May I know your current requirement and quantity?

Regards,
{{myCompany}}`,
  
  agentSystemInstruction: `You are an expert export sales representative for {{myCompany}}.
Goal: Build trust, qualify the lead, and move towards sending samples or a price quote.
Tone: Professional, polite, concise, solution-oriented. International Business English.

Instructions:
- Answer their specific questions.
- If they ask for price, give a general range or ask for specific Incoterms/Port.
- Always end with a small question to keep the conversation moving.
- Keep it under 100 words.
- If the user seems angry, confused, or asks for a manager, flag for human review.`
};

export const DEFAULT_NOTIFICATIONS: NotificationConfig = {
  emailQualified: true,
  pushMessages: true,
  dailyDigest: false,
  criticalAlerts: true
};

// WeChat Message Types
export interface WeChatTextMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: 'text';
  Content: string;
  MsgId: string;
}

export interface WeChatImageMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: 'image';
  PicUrl: string;
  MediaId: string;
  MsgId: string;
}

export interface WeChatVoiceMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: 'voice';
  MediaId: string;
  Format: string;
  Recognition?: string; // Voice recognition result
  MsgId: string;
}

export interface WeChatVideoMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: 'video';
  MediaId: string;
  ThumbMediaId: string;
  MsgId: string;
}

export interface WeChatEventMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: 'event';
  Event: 'subscribe' | 'unsubscribe' | 'SCAN' | 'LOCATION' | 'CLICK' | 'VIEW';
  EventKey?: string;
  Ticket?: string; // For QR code scan events
  Latitude?: number; // For location events
  Longitude?: number; // For location events
}

export type WeChatMessage = WeChatTextMessage | WeChatImageMessage | WeChatVoiceMessage | WeChatVideoMessage | WeChatEventMessage;

export interface WeChatWebhookPayload {
  xml: WeChatMessage;
}

export interface WeChatUserInfo {
  subscribe: number; // 0 = not subscribed, 1 = subscribed
  openid: string;
  nickname?: string;
  sex?: number; // 0 = unknown, 1 = male, 2 = female
  language?: string;
  city?: string;
  province?: string;
  country?: string;
  headimgurl?: string;
  subscribe_time?: number;
  unionid?: string;
  remark?: string;
  groupid?: number;
  tagid_list?: number[];
  subscribe_scene?: string;
  qr_scene?: number;
  qr_scene_str?: string;
}

export interface WeChatQRCodeResponse {
  ticket: string;
  expire_seconds: number;
  url: string;
}

// Admin & API Key Management Types
export interface AdminAction {
  id: string;
  userId: string;
  userName: string;
  action: string; // 'api_key_created', 'settings_modified', etc.
  resource: string; // 'api_key:gemini-001', 'settings:templates'
  details: Record<string, any>;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}

export enum ApiKeyProvider {
  GEMINI = 'gemini',
  WHATSAPP = 'whatsapp',
  WECHAT = 'wechat',
  EMAIL_GMAIL = 'email_gmail',
  EMAIL_OUTLOOK = 'email_outlook',
  EMAIL_SMTP = 'email_smtp',
  CUSTOM = 'custom'
}

export interface ApiKey {
  id: string;
  provider: ApiKeyProvider;
  label: string; // User-friendly name
  keyValue: string; // Encrypted
  metadata: {
    createdAt: number;
    createdBy: string;
    lastUsed?: number;
    lastRotated?: number;
    usageCount: number;
    errorCount: number;
    isActive: boolean;
    isPrimary: boolean; // Primary key for this provider
  };
  limits?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    rateLimitPerMinute?: number;
  };
  permissions?: string[]; // Provider-specific scopes
  tags?: string[]; // For organization
  notes?: string;
}

export interface ApiKeyUsage {
  keyId: string;
  timestamp: number;
  provider: ApiKeyProvider;
  action: string; // 'generate_message', 'send_whatsapp', etc.
  success: boolean;
  responseTime?: number; // ms
  errorCode?: string;
  errorMessage?: string;
  cost?: number; // If applicable
}

export interface KeyStatistics {
  keyId: string;
  timeframe: '24h' | '7d' | '30d';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  cost?: number;
  requestsByHour?: Array<{ hour: number; count: number }>;
}

export interface UsageStats {
  provider?: ApiKeyProvider;
  timeframe: string;
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  totalCost?: number;
  keysUsed: number;
}

export interface PerformanceMetrics {
  keyId: string;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number; // requests per minute
}

export interface Alert {
  id: string;
  type: 'rate_limit' | 'error_spike' | 'key_expired' | 'quota_exceeded';
  keyId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

// Admin Monitoring Dashboard Types
export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  apiKeys: { status: string; active: number; issues: number };
  conversations: { active: number; healthy: number; issues: number };
  aiService: { status: string; errorRate: number };
  lastUpdated: number;
}

export interface AiInteractionMetrics {
  totalCalls: number;
  successRate: number;
  averageResponseTime: number;
  totalCost?: number;
  callsByHour: Array<{ hour: number; count: number }>;
  errorBreakdown: Record<string, number>;
  timeframe: string;
}

export interface ConversationHealthMetrics {
  totalConversations: number;
  activeConversations: number;
  averageSatisfaction: number;
  sentimentDistribution: Record<string, number>;
  healthScore: number; // 0-100
  issues: Array<{ conversationId: string; issue: string; severity: 'warning' | 'critical' }>;
}

export interface SystemAlert {
  id: string;
  type: 'api_key' | 'conversation' | 'ai_service' | 'system';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  actionUrl?: string;
}

export const canEditSettings = (role: UserRole) => role === UserRole.ADMIN || role === UserRole.OWNER;
export const canExportData = (role: UserRole) => role === UserRole.ADMIN || role === UserRole.OWNER;
export const canSendMessages = (role: UserRole) => role === UserRole.ADMIN || role === UserRole.SALES || role === UserRole.OWNER;

// Purchase Pattern Analysis Types
export enum PurchaseCycle {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEASONAL = 'seasonal',
  IRREGULAR = 'irregular'
}

export enum CustomerIntentType {
  IMMINENT_ORDER = 'imminent_order',
  REGULAR_CYCLE = 'regular_cycle',
  DORMANT = 'dormant',
  UPSELL_OPPORTUNITY = 'upsell_opportunity'
}

export interface PurchaseOrder {
  id: string;
  // Exporter Information
  exporterName: string;
  exporterAddress: string;
  pinCode: string;
  city: string;
  state: string;
  contactNo: string;
  emailId: string;
  
  // Consignee Information
  consigneeName: string;
  probConsigneeName?: string;
  consigneeAddress: string;
  
  // Shipping Information
  portCode: string;
  foreignPort: string;
  foreignCountry: string;
  indianPort: string;
  mode: string;
  shipmentStatus: string;
  
  // Product Information
  hsCode: string;
  chapter: string;
  productDescription: string;
  quantity: number;
  unitQuantity: string;
  
  // Pricing Information
  itemRateInFC: number;
  currency: string;
  totalValueInFC: number;
  unitRateUSD: number;
  exchangeRate: number;
  totalValueInUSD: number;
  unitRateInINR: number;
  fob: number;
  drawback?: number;
  
  // Temporal Information
  month: number;
  year: number;
  orderDate: number; // Timestamp derived from month/year
  
  // Metadata
  importedAt: number;
  sourceFile?: string;
}

export interface PurchasePattern {
  customerId: string; // Derived from contactNo or emailId
  customerName: string;
  productCategory: string;
  productDescription: string;
  averageQuantity: number;
  averageValue: number;
  purchaseFrequency: number; // Average days between purchases
  lastPurchaseDate: number;
  nextPredictedDate: number;
  purchaseCycle: PurchaseCycle;
  totalOrders: number;
  totalSpend: number;
  firstPurchaseDate: number;
  relatedProducts?: string[]; // Products frequently bought together
}

export interface CustomerIntent {
  customerId: string;
  customerName: string;
  contactNo?: string;
  emailId?: string;
  intentType: CustomerIntentType;
  predictedProducts: Array<{
    productDescription: string;
    predictedQuantity: number;
    confidence: number; // 0-1
  }>;
  predictedQuantities: Record<string, number>; // Product -> quantity
  confidenceScore: number; // 0-1
  recommendedMessage: string;
  analysisSummary: string;
  orderPrediction: string;
  lastOrderDate?: number;
  daysSinceLastOrder?: number;
  typicalCycleDays?: number;
}

export interface PurchaseAnalysisResult {
  analysis_summary: string;
  order_prediction: string;
  message_to_customer: string;
}

// Company Details Configuration
export interface CompanyDetails {
  id: string;
  companyName: string;
  phone: string; // WhatsApp/primary phone
  websiteUrl?: string;
  email: string;
  contactPersonName: string;
  contactPersonTitle?: string; // Owner/Director/Manager
  logoUrl?: string; // Path to uploaded logo
  registrationDocuments?: string[]; // Paths to uploaded documents
  certificates?: string[]; // Paths to uploaded certificates
  createdAt: number;
  updatedAt: number;
}

// Products Catalog
export interface ProductPhoto {
  id: string;
  url: string; // Public URL for sharing
  thumbnailUrl?: string; // Optimized thumbnail
  fileName: string;
  fileSize: number; // bytes
  mimeType: string; // image/jpeg, image/png, image/webp
  width?: number;
  height?: number;
  isPrimary: boolean; // Main product image
  uploadedAt: number;
}

export interface Product {
  id: string;
  name: string; // Required, searchable
  category: string; // FMCG, Grocery, Electronics, etc.
  shortDescription: string; // Brief description
  fullDescription: string; // Detailed info for AI to use in messaging
  unit: string; // kg, piece, box, liter, MT, etc.
  referencePrice?: number; // Indicative price for AI reference (NOT final quote)
  referencePriceCurrency?: string; // USD, INR, EUR, etc.
  photos: ProductPhoto[]; // Multiple images support
  tags: string[]; // Keywords for AI search and recommendations
  specifications?: Record<string, string>; // e.g., { weight: "500g", packaging: "Box" }
  relatedProducts?: string[]; // Product IDs frequently bought together
  status: 'active' | 'inactive'; // Replaces 'active' boolean
  aiUsageCount?: number; // Track how often AI recommends this product
  lastRecommendedAt?: number; // Last time AI recommended this product
  createdAt: number;
  updatedAt: number;
  createdBy?: string; // User ID who created
  updatedBy?: string; // User ID who last updated
}

// Product Pricing
export interface ProductPrice {
  id: string;
  productId: string; // Link to Product
  productName: string; // Denormalized for quick access
  unitOfMeasure: string; // kg, piece, box, packet, MT, etc.
  referencePrice: number; // Renamed from basePrice - indicates this is for AI reference only
  currency: string; // USD, EUR, INR, etc.
  effectiveDate: number; // When price became effective
  lastUpdated: number;
  notes?: string;
  active: boolean;
}

// Product Recommendations
export interface ProductRecommendation {
  productId: string;
  productName: string;
  reason: 'previous_purchase' | 'category_match' | 'location_match' | 'seasonal' | 'related_product' | 'ai_suggested';
  confidence: number; // 0-100
  context?: string; // Additional context for recommendation
}

export interface EmailConnectionStatus {
  connected: boolean;
  userEmail?: string;
  lastSync?: number;
  tokenExpiry?: number;
  autoReplyEnabled: boolean;
  aiDraftApprovalRequired: boolean;
}
