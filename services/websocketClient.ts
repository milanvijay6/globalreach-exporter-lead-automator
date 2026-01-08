/**
 * WebSocket Client Service
 * Manages WebSocket connections for real-time updates
 * Replaces polling in various components
 */

type SubscriptionType = 'lead-updates' | 'dashboard' | 'email-ingestion' | 'system-status';

interface Subscription {
  id: string;
  type: SubscriptionType;
  payload?: any;
  callback: (data: any) => void;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string;
  private userId: string | null = null;

  constructor() {
    // Determine WebSocket URL
    const isCloudflarePages = typeof window !== 'undefined' && 
      (window.location.hostname.includes('pages.dev') || 
       window.location.hostname.includes('cloudflarepages.com'));
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = isCloudflarePages 
      ? window.location.host 
      : (process.env.REACT_APP_WS_URL || window.location.host);
    
    this.url = `${wsProtocol}//${wsHost}${process.env.REACT_APP_WS_ENDPOINT || '/ws'}`;
    
    // Get user ID from session
    try {
      const sessionData = localStorage.getItem('web_secure_globalreach_user_session');
      if (sessionData) {
        const parsed = JSON.parse(atob(sessionData));
        if (parsed && parsed.user && parsed.user.id) {
          this.userId = parsed.user.id;
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        this.ws = new WebSocket(this.url);

        // Set up headers (if supported by browser)
        // Note: Browser WebSocket API doesn't support custom headers
        // User ID would be sent after connection or via query params

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.reconnectAttempts = 0;
          
          // Send user ID if available (via message)
          if (this.userId) {
            this.send({
              type: 'set-user-id',
              payload: { userId: this.userId },
            });
          }
          
          // Re-subscribe to all active subscriptions
          this.resubscribeAll();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
          this.ws = null;
          
          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`[WebSocket] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
          } else {
            console.error('[WebSocket] Max reconnection attempts reached');
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.ws) {
      // Unsubscribe from all subscriptions
      this.subscriptions.forEach((sub) => {
        this.unsubscribe(sub.id);
      });
      
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send message to server
   */
  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send message, not connected');
    }
  }

  /**
   * Subscribe to updates
   */
  subscribe(
    type: SubscriptionType,
    payload: any,
    callback: (data: any) => void
  ): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: Subscription = {
      id: subscriptionId,
      type,
      payload,
      callback,
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    // Send subscription request
    this.send({
      type: `subscribe:${type}`,
      payload,
    });
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.send({
        type: 'unsubscribe',
        payload: { subscriptionId },
      });
      
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: any) {
    const { type, subscriptionId, data: messageData } = data;
    
    if (type === 'connected') {
      console.log('[WebSocket] Connection confirmed:', data);
      return;
    }
    
    if (type === 'subscribed') {
      console.log('[WebSocket] Subscription confirmed:', data);
      return;
    }
    
    if (type === 'unsubscribed') {
      console.log('[WebSocket] Unsubscription confirmed:', data);
      return;
    }
    
    if (type === 'pong') {
      // Heartbeat response
      return;
    }
    
    // Route message to appropriate subscription callback
    if (subscriptionId) {
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription) {
        subscription.callback(messageData || data);
      }
    } else {
      // Broadcast message - call all callbacks
      this.subscriptions.forEach((sub) => {
        if (sub.type === type.replace('-update', '')) {
          sub.callback(messageData || data);
        }
      });
    }
  }

  /**
   * Re-subscribe to all active subscriptions
   */
  private resubscribeAll() {
    this.subscriptions.forEach((sub) => {
      this.send({
        type: `subscribe:${sub.type}`,
        payload: sub.payload,
      });
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const websocketClient = new WebSocketClient();

// Auto-connect on module load (if in browser)
if (typeof window !== 'undefined') {
  websocketClient.connect().catch(error => {
    console.warn('[WebSocket] Failed to connect on load:', error);
  });
}

