import { Logger } from './loggerService';
import { PlatformService } from './platformService';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Let's Encrypt Service
 * Handles ACME protocol and certificate management
 */

const STORAGE_KEY_CERTIFICATES = 'globalreach_certificates';
const CERT_DIR = 'certs';

interface CertificateInfo {
  domain: string;
  certPath: string;
  keyPath: string;
  fullchainPath: string;
  expiresAt: number;
  createdAt: number;
}

/**
 * Gets certificate storage path
 */
const getCertDir = async (): Promise<string> => {
  // In Electron, use userData directory
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const { app } = require('electron');
    const userData = app.getPath('userData');
    const certPath = path.join(userData, CERT_DIR);
    if (!fs.existsSync(certPath)) {
      fs.mkdirSync(certPath, { recursive: true });
    }
    return certPath;
  }
  
  // Fallback for web
  return path.join(process.cwd(), CERT_DIR);
};

/**
 * Generates Let's Encrypt certificate
 */
export const generateLetsEncryptCertificate = async (
  domain: string,
  email: string,
  challengeHandler: (token: string, keyAuthorization: string) => Promise<void>
): Promise<CertificateInfo> => {
  try {
    Logger.info(`[LetsEncrypt] Generating certificate for domain: ${domain}`);
    
    // Import acme-client dynamically
    const acme = await import('acme-client');
    const client = new acme.Client({
      directoryUrl: acme.directory.letsencrypt.production,
      accountKey: await getOrCreateAccountKey(),
    });
    
    // Create account
    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: [`mailto:${email}`],
    });
    
    // Create order
    const order = await client.createOrder({
      identifiers: [{ type: 'dns', value: domain }],
    });
    
    // Get authorizations
    const authorizations = await client.getAuthorizations(order);
    
    // Complete challenges
    for (const auth of authorizations) {
      const challenge = auth.challenges.find((c: any) => c.type === 'http-01');
      if (!challenge) {
        throw new Error('HTTP-01 challenge not found');
      }
      
      const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
      
      // Handle challenge via callback
      await challengeHandler(challenge.token, keyAuthorization);
      
      // Verify challenge
      await client.verifyChallenge(auth, challenge);
      
      // Complete challenge
      await client.completeChallenge(challenge);
      
      // Wait for challenge to be verified
      await client.waitForValidStatus(challenge);
    }
    
    // Finalize order
    const [key, csr] = await acme.crypto.createCsr({
      commonName: domain,
    });
    
    await client.finalizeOrder(order, csr);
    
    // Get certificate
    const cert = await client.getCertificate(order);
    
    // Save certificate
    const certDir = await getCertDir();
    const certPath = path.join(certDir, `${domain}.crt`);
    const keyPath = path.join(certDir, `${domain}.key`);
    const fullchainPath = path.join(certDir, `${domain}-fullchain.crt`);
    
    fs.writeFileSync(certPath, cert.cert);
    fs.writeFileSync(keyPath, key.toString());
    fs.writeFileSync(fullchainPath, cert.cert + cert.chain);
    
    const certInfo: CertificateInfo = {
      domain,
      certPath,
      keyPath,
      fullchainPath,
      expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 days
      createdAt: Date.now(),
    };
    
    // Save certificate info
    await saveCertificateInfo(certInfo);
    
    Logger.info(`[LetsEncrypt] Certificate generated successfully for ${domain}`);
    
    return certInfo;
  } catch (error) {
    Logger.error('[LetsEncrypt] Failed to generate certificate:', error);
    throw error;
  }
};

/**
 * Gets or creates account key
 */
const getOrCreateAccountKey = async (): Promise<string> => {
  const stored = await PlatformService.secureLoad('letsencrypt_account_key');
  if (stored) {
    return stored;
  }
  
  // Generate new account key
  const acme = await import('acme-client');
  const accountKey = await acme.crypto.createPrivateKey();
  const keyString = accountKey.toString();
  
  await PlatformService.secureSave('letsencrypt_account_key', keyString);
  
  return keyString;
};

/**
 * Saves certificate information
 */
const saveCertificateInfo = async (certInfo: CertificateInfo): Promise<void> => {
  const stored = await PlatformService.secureLoad(STORAGE_KEY_CERTIFICATES);
  const certificates: CertificateInfo[] = stored ? JSON.parse(stored) : [];
  
  const index = certificates.findIndex(c => c.domain === certInfo.domain);
  if (index >= 0) {
    certificates[index] = certInfo;
  } else {
    certificates.push(certInfo);
  }
  
  await PlatformService.secureSave(STORAGE_KEY_CERTIFICATES, JSON.stringify(certificates));
};

/**
 * Gets certificate information
 */
export const getCertificateInfo = async (domain: string): Promise<CertificateInfo | null> => {
  const stored = await PlatformService.secureLoad(STORAGE_KEY_CERTIFICATES);
  if (!stored) return null;
  
  const certificates: CertificateInfo[] = JSON.parse(stored);
  return certificates.find(c => c.domain === domain) || null;
};

/**
 * Checks if certificate needs renewal
 */
export const needsRenewal = (certInfo: CertificateInfo): boolean => {
  const renewalThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days before expiry
  const timeUntilExpiry = certInfo.expiresAt - Date.now();
  return timeUntilExpiry < renewalThreshold;
};

/**
 * Renews certificate
 */
export const renewCertificate = async (
  domain: string,
  email: string,
  challengeHandler: (token: string, keyAuthorization: string) => Promise<void>
): Promise<CertificateInfo> => {
  Logger.info(`[LetsEncrypt] Renewing certificate for domain: ${domain}`);
  return generateLetsEncryptCertificate(domain, email, challengeHandler);
};

