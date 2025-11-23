import { Logger } from './loggerService';
import { PlatformService } from './platformService';
import { getCertificateInfo, needsRenewal, renewCertificate } from './letsencryptService';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * TLS Service
 * Manages TLS/HTTPS configuration and certificates
 */

const STORAGE_KEY_TLS_CONFIG = 'globalreach_tls_config';

export interface TLSConfig {
  enabled: boolean;
  mode: 'letsencrypt' | 'self-signed' | 'custom';
  domain?: string;
  email?: string;
  certPath?: string;
  keyPath?: string;
  port: number;
}

/**
 * Gets TLS configuration
 */
export const getTLSConfig = async (): Promise<TLSConfig> => {
  const stored = await PlatformService.secureLoad(STORAGE_KEY_TLS_CONFIG);
  if (stored) {
    return JSON.parse(stored);
  }
  
  return {
    enabled: false,
    mode: 'self-signed',
    port: 443,
  };
};

/**
 * Saves TLS configuration
 */
export const saveTLSConfig = async (config: TLSConfig): Promise<void> => {
  await PlatformService.secureSave(STORAGE_KEY_TLS_CONFIG, JSON.stringify(config));
  Logger.info('[TLSService] TLS configuration saved');
};

/**
 * Generates self-signed certificate
 */
export const generateSelfSignedCertificate = async (domain: string = 'localhost'): Promise<{ cert: string; key: string }> => {
  try {
    Logger.info(`[TLSService] Generating self-signed certificate for ${domain}`);
    
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    
    const cert = crypto.createCertificate({
      publicKey,
      privateKey,
      serialNumber: crypto.randomBytes(16).toString('hex'),
      issuer: { CN: domain },
      subject: { CN: domain },
      notBefore: new Date(),
      notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      extensions: [
        {
          name: 'basicConstraints',
          cA: false,
        },
        {
          name: 'keyUsage',
          keyEncipherment: true,
          digitalSignature: true,
        },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: domain },
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
          ],
        },
      ],
    });
    
    const certPem = cert.toString();
    
    Logger.info('[TLSService] Self-signed certificate generated');
    
    return {
      cert: certPem,
      key: privateKey,
    };
  } catch (error) {
    Logger.error('[TLSService] Failed to generate self-signed certificate:', error);
    throw error;
  }
};

/**
 * Saves certificate files
 */
export const saveCertificateFiles = async (
  cert: string,
  key: string,
  domain: string
): Promise<{ certPath: string; keyPath: string }> => {
  // In Electron, use userData directory
  let certDir: string;
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const { app } = require('electron');
    const userData = app.getPath('userData');
    certDir = path.join(userData, 'certs');
  } else {
    certDir = path.join(process.cwd(), 'certs');
  }
  
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }
  
  const certPath = path.join(certDir, `${domain}.crt`);
  const keyPath = path.join(certDir, `${domain}.key`);
  
  fs.writeFileSync(certPath, cert);
  fs.writeFileSync(keyPath, key);
  
  // Set secure permissions (Unix-like systems)
  if (process.platform !== 'win32') {
    fs.chmodSync(certPath, 0o644);
    fs.chmodSync(keyPath, 0o600);
  }
  
  return { certPath, keyPath };
};

/**
 * Gets certificate files for Express HTTPS
 */
export const getCertificateFiles = async (domain: string): Promise<{ cert: Buffer; key: Buffer } | null> => {
  try {
    const certInfo = await getCertificateInfo(domain);
    if (!certInfo) return null;
    
    if (!fs.existsSync(certInfo.certPath) || !fs.existsSync(certInfo.keyPath)) {
      Logger.warn('[TLSService] Certificate files not found');
      return null;
    }
    
    return {
      cert: fs.readFileSync(certInfo.certPath),
      key: fs.readFileSync(certInfo.keyPath),
    };
  } catch (error) {
    Logger.error('[TLSService] Failed to read certificate files:', error);
    return null;
  }
};

/**
 * Checks certificate expiry
 */
export const checkCertificateExpiry = async (domain: string): Promise<{ valid: boolean; daysUntilExpiry: number }> => {
  const certInfo = await getCertificateInfo(domain);
  if (!certInfo) {
    return { valid: false, daysUntilExpiry: 0 };
  }
  
  const daysUntilExpiry = Math.floor((certInfo.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
  
  return {
    valid: daysUntilExpiry > 0,
    daysUntilExpiry: Math.max(0, daysUntilExpiry),
  };
};

/**
 * Sets up automatic certificate renewal
 */
export const setupAutoRenewal = async (
  domain: string,
  email: string,
  challengeHandler: (token: string, keyAuthorization: string) => Promise<void>
): Promise<void> => {
  const certInfo = await getCertificateInfo(domain);
  if (!certInfo) {
    Logger.warn('[TLSService] No certificate found for auto-renewal');
    return;
  }
  
  if (needsRenewal(certInfo)) {
    Logger.info(`[TLSService] Certificate for ${domain} needs renewal`);
    try {
      await renewCertificate(domain, email, challengeHandler);
      Logger.info(`[TLSService] Certificate renewed successfully for ${domain}`);
    } catch (error) {
      Logger.error(`[TLSService] Failed to renew certificate for ${domain}:`, error);
    }
  }
};

