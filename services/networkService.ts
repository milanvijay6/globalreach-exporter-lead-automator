import { Logger } from './loggerService';
import { PlatformService } from './platformService';

/**
 * Network Service
 * Handles network interface detection and configuration
 */

const STORAGE_KEY_NETWORK_CONFIG = 'globalreach_network_config';

export interface NetworkConfig {
  binding: 'localhost' | 'network'; // 'localhost' = 127.0.0.1, 'network' = 0.0.0.0
  allowedIPs?: string[]; // Optional IP whitelist
  firewallConfigured: boolean;
}

export interface NetworkInterface {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
  mac?: string;
}

/**
 * Gets network configuration
 */
export const getNetworkConfig = async (): Promise<NetworkConfig> => {
  const stored = await PlatformService.secureLoad(STORAGE_KEY_NETWORK_CONFIG);
  if (stored) {
    return JSON.parse(stored);
  }
  
  return {
    binding: 'network', // Default to network access
    firewallConfigured: false,
  };
};

/**
 * Saves network configuration
 */
export const saveNetworkConfig = async (config: NetworkConfig): Promise<void> => {
  await PlatformService.secureSave(STORAGE_KEY_NETWORK_CONFIG, JSON.stringify(config));
  Logger.info('[NetworkService] Network configuration saved');
};

/**
 * Gets all network interfaces
 */
export const getNetworkInterfaces = async (): Promise<NetworkInterface[]> => {
  // Only works in Node.js/Electron main process
  if (typeof window !== 'undefined') {
    // In browser/renderer, return empty or use WebRTC to get local IP
    try {
      // Try to get local IP via WebRTC (browser-only)
      const interfaces: NetworkInterface[] = [];
      
      // Fallback: return localhost
      interfaces.push({
        name: 'localhost',
        address: '127.0.0.1',
        family: 'IPv4',
        internal: true,
      });
      
      return interfaces;
    } catch {
      return [];
    }
  }
  
  try {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const result: NetworkInterface[] = [];
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs || !Array.isArray(addrs)) continue;
      
      for (const addr of addrs) {
        result.push({
          name,
          address: addr.address,
          family: addr.family === 'IPv4' ? 'IPv4' : 'IPv6',
          internal: addr.internal,
          mac: addr.mac,
        });
      }
    }
    
    return result;
  } catch (error) {
    Logger.error('[NetworkService] Failed to get network interfaces:', error);
    return [];
  }
};

/**
 * Gets accessible URLs for the server
 */
export const getAccessibleURLs = async (port: number, httpsPort?: number): Promise<string[]> => {
  const config = await getNetworkConfig();
  const interfaces = await getNetworkInterfaces();
  const urls: string[] = [];
  
  // Always add localhost
  urls.push(`http://localhost:${port}`);
  if (httpsPort) {
    urls.push(`https://localhost:${httpsPort}`);
  }
  
  if (config.binding === 'network') {
    // Add network IPs
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        urls.push(`http://${iface.address}:${port}`);
        if (httpsPort) {
          urls.push(`https://${iface.address}:${httpsPort}`);
        }
      }
    }
  }
  
  return urls;
};

/**
 * Configures Windows Firewall rule
 */
export const configureFirewallRule = async (port: number, name: string = 'GlobalReach'): Promise<boolean> => {
  if (process.platform !== 'win32') {
    Logger.warn('[NetworkService] Firewall configuration only supported on Windows');
    return false;
  }
  
  try {
    const { execSync } = require('child_process');
    
    // Check if rule exists
    try {
      execSync(`netsh advfirewall firewall show rule name="${name}"`, { stdio: 'pipe' });
      Logger.info(`[NetworkService] Firewall rule "${name}" already exists`);
      return true;
    } catch (error) {
      // Rule doesn't exist, create it
    }
    
    // Create firewall rule
    const command = `netsh advfirewall firewall add rule name="${name}" dir=in action=allow protocol=TCP localport=${port}`;
    execSync(command, { stdio: 'pipe' });
    
    Logger.info(`[NetworkService] Firewall rule created for port ${port}`);
    
    const config = await getNetworkConfig();
    config.firewallConfigured = true;
    await saveNetworkConfig(config);
    
    return true;
  } catch (error) {
    Logger.error('[NetworkService] Failed to configure firewall:', error);
    return false;
  }
};

/**
 * Removes firewall rule
 */
export const removeFirewallRule = async (name: string = 'GlobalReach'): Promise<boolean> => {
  if (process.platform !== 'win32') {
    return false;
  }
  
  try {
    const { execSync } = require('child_process');
    execSync(`netsh advfirewall firewall delete rule name="${name}"`, { stdio: 'pipe' });
    Logger.info(`[NetworkService] Firewall rule "${name}" removed`);
    return true;
  } catch (error) {
    Logger.error('[NetworkService] Failed to remove firewall rule:', error);
    return false;
  }
};

