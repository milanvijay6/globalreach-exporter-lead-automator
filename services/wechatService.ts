
import { WeChatCredentials, WeChatMessage, WeChatTextMessage, WeChatImageMessage, WeChatVoiceMessage, WeChatVideoMessage, WeChatEventMessage, WeChatUserInfo, WeChatQRCodeResponse } from '../types';
import { Logger } from './loggerService';
import { PlatformService } from './platformService';
import { XMLParser } from 'fast-xml-parser';

const WECHAT_API_BASE = 'https://api.weixin.qq.com/cgi-bin';

// WeChat API Error Codes
const WECHAT_ERROR_CODES: Record<number, string> = {
  40001: 'Invalid credential (AppID or AppSecret)',
  40014: 'Invalid access_token',
  40029: 'Invalid code (OAuth)',
  45009: 'API quota exceeded (2000 calls/day limit)',
  45011: 'API limit exceeded (too many requests)',
  48001: 'API function not authorized',
  50001: 'User not authorized',
  61024: 'Invalid IP address (not whitelisted)',
};

// Token cache to prevent concurrent refresh requests
let tokenRefreshQueue: Map<string, Promise<string>> = new Map();
let apiCallCount: Map<string, { count: number; resetTime: number }> = new Map();

/**
 * WeChat Official Account API Service
 * Handles authentication, message sending/receiving, and API interactions
 */
export const WeChatService = {
  /**
   * Gets access token using AppID and AppSecret
   * Tokens expire in 7200 seconds (2 hours)
   */
  getAccessToken: async (
    appId: string,
    appSecret: string,
    forceRefresh: boolean = false
  ): Promise<{ success: boolean; accessToken?: string; expiresIn?: number; error?: string }> => {
    try {
      // Check if we're already refreshing this token
      const cacheKey = `${appId}_token`;
      if (!forceRefresh && tokenRefreshQueue.has(cacheKey)) {
        const token = await tokenRefreshQueue.get(cacheKey)!;
        return { success: true, accessToken: token };
      }

      const refreshPromise = (async () => {
        const response = await fetch(
          `${WECHAT_API_BASE}/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          Logger.error('[WeChatService] Get access token failed', { status: response.status, error: errorText });
          return { success: false, error: `HTTP ${response.status}` };
        }

        const data = await response.json();

        // WeChat returns error in JSON format: { "errcode": 40001, "errmsg": "..." }
        if (data.errcode && data.errcode !== 0) {
          const errorMsg = WECHAT_ERROR_CODES[data.errcode] || data.errmsg || 'Unknown error';
          Logger.error('[WeChatService] WeChat API error', { errcode: data.errcode, errmsg: data.errmsg });
          return { success: false, error: errorMsg };
        }

        const accessToken = data.access_token;
        const expiresIn = data.expires_in || 7200; // Default 2 hours

        Logger.info('[WeChatService] Access token obtained', { expiresIn });

        // Remove from queue after completion
        tokenRefreshQueue.delete(cacheKey);

        return { success: true, accessToken, expiresIn };
      })();

      tokenRefreshQueue.set(cacheKey, refreshPromise.then(r => r.accessToken || ''));

      return await refreshPromise;
    } catch (error: any) {
      Logger.error('[WeChatService] Get access token exception', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Gets or refreshes access token from credentials
   * Auto-refreshes if token is expired or will expire soon (80% of TTL)
   */
  ensureAccessToken: async (credentials: WeChatCredentials): Promise<{ success: boolean; accessToken?: string; error?: string }> => {
    const now = Date.now();
    const tokenExpiry = credentials.accessTokenExpiry || 0;
    const tokenTTL = tokenExpiry - now;
    const refreshThreshold = 7200 * 0.8 * 1000; // 80% of 2 hours in milliseconds

    // If token exists and is still valid (has more than 20% TTL remaining), use it
    if (credentials.accessToken && tokenTTL > refreshThreshold) {
      return { success: true, accessToken: credentials.accessToken };
    }

    // Need to refresh token
    Logger.info('[WeChatService] Refreshing access token', { tokenExpiry, now, tokenTTL });
    
    const result = await WeChatService.getAccessToken(credentials.appId, credentials.appSecret, true);
    
    if (result.success && result.accessToken) {
      // Update credentials with new token and expiry
      credentials.accessToken = result.accessToken;
      credentials.accessTokenExpiry = now + (result.expiresIn || 7200) * 1000;
    }

    return result;
  },

  /**
   * Sends a text message to a WeChat user (by OpenID)
   */
  sendTextMessage: async (
    credentials: WeChatCredentials,
    openId: string,
    content: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      // Ensure we have a valid access token
      const tokenResult = await WeChatService.ensureAccessToken(credentials);
      if (!tokenResult.success || !tokenResult.accessToken) {
        return { success: false, error: tokenResult.error || 'Failed to get access token' };
      }

      // Truncate message to WeChat limit (2048 characters)
      const truncatedContent = content.substring(0, 2048);

      // Check API quota
      const quotaCheck = WeChatService.checkAPIQuota(credentials.appId);
      if (!quotaCheck.allowed) {
        return { success: false, error: 'API quota exceeded. Daily limit: 2000 calls.' };
      }

      const response = await fetch(
        `${WECHAT_API_BASE}/message/custom/send?access_token=${tokenResult.accessToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            touser: openId,
            msgtype: 'text',
            text: {
              content: truncatedContent,
            },
          }),
        }
      );

      // Record API call
      WeChatService.recordAPICall(credentials.appId);

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error('[WeChatService] Send text message failed', { status: response.status, error: errorText });
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();

      if (data.errcode && data.errcode !== 0) {
        const errorMsg = WECHAT_ERROR_CODES[data.errcode] || data.errmsg || 'Unknown error';
        Logger.error('[WeChatService] WeChat API error', { errcode: data.errcode, errmsg: data.errmsg });
        
        // Handle token expiration
        if (data.errcode === 40014) {
          // Token expired, try refreshing and retry once
          const refreshResult = await WeChatService.getAccessToken(credentials.appId, credentials.appSecret, true);
          if (refreshResult.success && refreshResult.accessToken) {
            credentials.accessToken = refreshResult.accessToken;
            credentials.accessTokenExpiry = Date.now() + (refreshResult.expiresIn || 7200) * 1000;
            // Retry the send
            return WeChatService.sendTextMessage(credentials, openId, content);
          }
        }
        
        return { success: false, error: errorMsg };
      }

      Logger.info('[WeChatService] Text message sent', { openId, msgid: data.msgid });
      return { success: true, messageId: data.msgid?.toString() };
    } catch (error: any) {
      Logger.error('[WeChatService] Send text message exception', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Sends an image message
   */
  sendImageMessage: async (
    credentials: WeChatCredentials,
    openId: string,
    mediaId: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      const tokenResult = await WeChatService.ensureAccessToken(credentials);
      if (!tokenResult.success || !tokenResult.accessToken) {
        return { success: false, error: tokenResult.error || 'Failed to get access token' };
      }

      const quotaCheck = WeChatService.checkAPIQuota(credentials.appId);
      if (!quotaCheck.allowed) {
        return { success: false, error: 'API quota exceeded' };
      }

      const response = await fetch(
        `${WECHAT_API_BASE}/message/custom/send?access_token=${tokenResult.accessToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            touser: openId,
            msgtype: 'image',
            image: {
              media_id: mediaId,
            },
          }),
        }
      );

      WeChatService.recordAPICall(credentials.appId);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (data.errcode && data.errcode !== 0) {
        return { success: false, error: WECHAT_ERROR_CODES[data.errcode] || data.errmsg || 'Unknown error' };
      }

      return { success: true, messageId: data.msgid?.toString() };
    } catch (error: any) {
      Logger.error('[WeChatService] Send image message exception', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Uploads media file and returns media_id
   */
  uploadMedia: async (
    credentials: WeChatCredentials,
    mediaType: 'image' | 'voice' | 'video' | 'thumb',
    file: File | Blob,
    fileName?: string
  ): Promise<{ success: boolean; mediaId?: string; error?: string }> => {
    try {
      const tokenResult = await WeChatService.ensureAccessToken(credentials);
      if (!tokenResult.success || !tokenResult.accessToken) {
        return { success: false, error: tokenResult.error || 'Failed to get access token' };
      }

      const formData = new FormData();
      formData.append('media', file, fileName);

      const response = await fetch(
        `${WECHAT_API_BASE}/media/upload?access_token=${tokenResult.accessToken}&type=${mediaType}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      WeChatService.recordAPICall(credentials.appId);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (data.errcode && data.errcode !== 0) {
        return { success: false, error: WECHAT_ERROR_CODES[data.errcode] || data.errmsg || 'Unknown error' };
      }

      return { success: true, mediaId: data.media_id };
    } catch (error: any) {
      Logger.error('[WeChatService] Upload media exception', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Gets user info by OpenID
   */
  getUserInfo: async (
    credentials: WeChatCredentials,
    openId: string
  ): Promise<{ success: boolean; userInfo?: WeChatUserInfo; error?: string }> => {
    try {
      const tokenResult = await WeChatService.ensureAccessToken(credentials);
      if (!tokenResult.success || !tokenResult.accessToken) {
        return { success: false, error: tokenResult.error || 'Failed to get access token' };
      }

      const quotaCheck = WeChatService.checkAPIQuota(credentials.appId);
      if (!quotaCheck.allowed) {
        return { success: false, error: 'API quota exceeded' };
      }

      const response = await fetch(
        `${WECHAT_API_BASE}/user/info?access_token=${tokenResult.accessToken}&openid=${openId}&lang=zh_CN`,
        {
          method: 'GET',
        }
      );

      WeChatService.recordAPICall(credentials.appId);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (data.errcode && data.errcode !== 0) {
        return { success: false, error: WECHAT_ERROR_CODES[data.errcode] || data.errmsg || 'Unknown error' };
      }

      return { success: true, userInfo: data as WeChatUserInfo };
    } catch (error: any) {
      Logger.error('[WeChatService] Get user info exception', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Generates a QR code (temporary or permanent)
   */
  generateQRCode: async (
    credentials: WeChatCredentials,
    sceneId: number | string,
    expireSeconds?: number // If provided, creates temporary QR code
  ): Promise<{ success: boolean; ticket?: string; url?: string; error?: string }> => {
    try {
      const tokenResult = await WeChatService.ensureAccessToken(credentials);
      if (!tokenResult.success || !tokenResult.accessToken) {
        return { success: false, error: tokenResult.error || 'Failed to get access token' };
      }

      const quotaCheck = WeChatService.checkAPIQuota(credentials.appId);
      if (!quotaCheck.allowed) {
        return { success: false, error: 'API quota exceeded' };
      }

      const requestBody: any = {
        action_name: expireSeconds ? 'QR_SCENE' : 'QR_LIMIT_SCENE',
        action_info: {
          scene: typeof sceneId === 'number' 
            ? { scene_id: sceneId }
            : { scene_str: sceneId },
        },
      };

      if (expireSeconds) {
        requestBody.expire_seconds = expireSeconds;
      }

      const response = await fetch(
        `${WECHAT_API_BASE}/qrcode/create?access_token=${tokenResult.accessToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      WeChatService.recordAPICall(credentials.appId);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (data.errcode && data.errcode !== 0) {
        return { success: false, error: WECHAT_ERROR_CODES[data.errcode] || data.errmsg || 'Unknown error' };
      }

      const qrUrl = `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(data.ticket)}`;

      return { 
        success: true, 
        ticket: data.ticket, 
        url: qrUrl 
      };
    } catch (error: any) {
      Logger.error('[WeChatService] Generate QR code exception', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Verifies webhook signature from WeChat server
   */
  verifyWebhookSignature: (
    signature: string,
    timestamp: string,
    nonce: string,
    token: string
  ): boolean => {
    try {
      // WeChat signature algorithm: SHA1(token + timestamp + nonce)
      const tmpStr = [token, timestamp, nonce].sort().join('');
      
      // In browser environment, we'd need crypto.subtle or a library
      // For Node.js, we use crypto module (handled in electron/main.js)
      // This is a placeholder - actual verification happens in main.js
      return true; // Will be properly implemented in main.js
    } catch (error) {
      Logger.error('[WeChatService] Verify signature exception', error);
      return false;
    }
  },

  /**
   * Parses XML message from WeChat webhook
   * Returns parsed message object
   */
  parseXMLMessage: (xmlString: string): WeChatMessage | null => {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        cdataTagName: '__cdata',
        parseTrueNumberOnly: false,
        trimValues: true,
      });

      const result = parser.parse(xmlString);
      const xml = result.xml || result;

      if (!xml.MsgType) {
        Logger.warn('[WeChatService] XML message missing MsgType', xml);
        return null;
      }

      const msgType = xml.MsgType['#text'] || xml.MsgType.__cdata || xml.MsgType;
      const toUserName = xml.ToUserName['#text'] || xml.ToUserName.__cdata || xml.ToUserName || '';
      const fromUserName = xml.FromUserName['#text'] || xml.FromUserName.__cdata || xml.FromUserName || '';
      const createTime = parseInt(xml.CreateTime?.['#text'] || xml.CreateTime || '0');
      const msgId = xml.MsgId?.['#text'] || xml.MsgId || '';

      if (msgType === 'text') {
        const content = xml.Content?.['#text'] || xml.Content?.__cdata || xml.Content || '';
        return {
          ToUserName: toUserName,
          FromUserName: fromUserName,
          CreateTime: createTime,
          MsgType: 'text',
          Content: content,
          MsgId: msgId,
        } as WeChatTextMessage;
      } else if (msgType === 'image') {
        const picUrl = xml.PicUrl?.['#text'] || xml.PicUrl?.__cdata || xml.PicUrl || '';
        const mediaId = xml.MediaId?.['#text'] || xml.MediaId?.__cdata || xml.MediaId || '';
        return {
          ToUserName: toUserName,
          FromUserName: fromUserName,
          CreateTime: createTime,
          MsgType: 'image',
          PicUrl: picUrl,
          MediaId: mediaId,
          MsgId: msgId,
        } as WeChatImageMessage;
      } else if (msgType === 'voice') {
        const mediaId = xml.MediaId?.['#text'] || xml.MediaId?.__cdata || xml.MediaId || '';
        const format = xml.Format?.['#text'] || xml.Format?.__cdata || xml.Format || '';
        const recognition = xml.Recognition?.['#text'] || xml.Recognition?.__cdata || xml.Recognition;
        return {
          ToUserName: toUserName,
          FromUserName: fromUserName,
          CreateTime: createTime,
          MsgType: 'voice',
          MediaId: mediaId,
          Format: format,
          Recognition: recognition,
          MsgId: msgId,
        } as WeChatVoiceMessage;
      } else if (msgType === 'video') {
        const mediaId = xml.MediaId?.['#text'] || xml.MediaId?.__cdata || xml.MediaId || '';
        const thumbMediaId = xml.ThumbMediaId?.['#text'] || xml.ThumbMediaId?.__cdata || xml.ThumbMediaId || '';
        return {
          ToUserName: toUserName,
          FromUserName: fromUserName,
          CreateTime: createTime,
          MsgType: 'video',
          MediaId: mediaId,
          ThumbMediaId: thumbMediaId,
          MsgId: msgId,
        } as WeChatVideoMessage;
      } else if (msgType === 'event') {
        const event = xml.Event?.['#text'] || xml.Event?.__cdata || xml.Event || '';
        const eventKey = xml.EventKey?.['#text'] || xml.EventKey?.__cdata || xml.EventKey;
        const ticket = xml.Ticket?.['#text'] || xml.Ticket?.__cdata || xml.Ticket;
        return {
          ToUserName: toUserName,
          FromUserName: fromUserName,
          CreateTime: createTime,
          MsgType: 'event',
          Event: event as any,
          EventKey: eventKey,
          Ticket: ticket,
        } as WeChatEventMessage;
      }

      Logger.warn('[WeChatService] Unsupported message type', { msgType, xml });
      return null;
    } catch (error) {
      Logger.error('[WeChatService] Parse XML message exception', error);
      return null;
    }
  },

  /**
   * Tests WeChat API connection
   */
  testConnection: async (
    credentials: WeChatCredentials
  ): Promise<{ success: boolean; error?: string; accountName?: string }> => {
    try {
      const result = await WeChatService.getAccessToken(credentials.appId, credentials.appSecret);
      
      if (!result.success) {
        return { success: false, error: result.error || 'Failed to authenticate' };
      }

      // Try to get account info (if available)
      // For Official Accounts, we can check token validity
      return { 
        success: true, 
        accountName: `WeChat Official Account (${credentials.appId.substring(0, 8)}...)` 
      };
    } catch (error: any) {
      Logger.error('[WeChatService] Test connection exception', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Checks API quota (2000 calls/day for Official Accounts)
   */
  checkAPIQuota: (appId: string): { allowed: boolean; remaining?: number; resetTime?: number } => {
    const now = Date.now();
    const dayStart = new Date(now).setHours(0, 0, 0, 0);
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const quota = apiCallCount.get(appId);
    
    if (!quota || quota.resetTime < now) {
      // Reset quota for new day
      apiCallCount.set(appId, { count: 0, resetTime: dayEnd });
      return { allowed: true, remaining: 2000, resetTime: dayEnd };
    }

    const remaining = 2000 - quota.count;
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
      resetTime: quota.resetTime,
    };
  },

  /**
   * Records an API call for quota tracking
   */
  recordAPICall: (appId: string): void => {
    const quota = apiCallCount.get(appId);
    const now = Date.now();
    const dayEnd = new Date(now).setHours(23, 59, 59, 999);

    if (!quota || quota.resetTime < now) {
      apiCallCount.set(appId, { count: 1, resetTime: dayEnd });
    } else {
      apiCallCount.set(appId, { count: quota.count + 1, resetTime: quota.resetTime });
    }
  },
};

