import { Logger } from './loggerService';
import { PlatformService } from './platformService';
import { autoUpdater } from 'electron-updater';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Update Service
 * Handles application updates with rollback capability
 */

const STORAGE_KEY_UPDATE_HISTORY = 'globalreach_update_history';
const BACKUP_DIR = 'update-backups';

export interface UpdateInfo {
  version: string;
  releaseDate: number;
  installed: boolean;
  rolledBack: boolean;
  notes?: string;
}

/**
 * Gets update history
 */
export const getUpdateHistory = async (): Promise<UpdateInfo[]> => {
  const stored = await PlatformService.secureLoad(STORAGE_KEY_UPDATE_HISTORY);
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
};

/**
 * Saves update to history
 */
const saveUpdateHistory = async (update: UpdateInfo): Promise<void> => {
  const history = await getUpdateHistory();
  history.unshift(update);
  // Keep last 10 updates
  const limited = history.slice(0, 10);
  await PlatformService.secureSave(STORAGE_KEY_UPDATE_HISTORY, JSON.stringify(limited));
};

/**
 * Creates backup before update
 */
export const createUpdateBackup = async (): Promise<string | null> => {
  try {
    // In Electron, backup userData
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const { app } = require('electron');
      const userData = app.getPath('userData');
      const backupPath = path.join(userData, BACKUP_DIR, `backup-${Date.now()}`);
      
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }
      
      // Copy important files
      const filesToBackup = ['config.json', 'certs', 'logs'];
      for (const file of filesToBackup) {
        const source = path.join(userData, file);
        const dest = path.join(backupPath, file);
        
        if (fs.existsSync(source)) {
          if (fs.statSync(source).isDirectory()) {
            copyDirectory(source, dest);
          } else {
            fs.copyFileSync(source, dest);
          }
        }
      }
      
      Logger.info(`[UpdateService] Backup created at: ${backupPath}`);
      return backupPath;
    }
    
    return null;
  } catch (error) {
    Logger.error('[UpdateService] Failed to create backup:', error);
    return null;
  }
};

/**
 * Copies directory recursively
 */
const copyDirectory = (src: string, dest: string): void => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

/**
 * Restores from backup
 */
export const restoreFromBackup = async (backupPath: string): Promise<boolean> => {
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const { app } = require('electron');
      const userData = app.getPath('userData');
      
      // Restore files
      const filesToRestore = ['config.json', 'certs'];
      for (const file of filesToRestore) {
        const source = path.join(backupPath, file);
        const dest = path.join(userData, file);
        
        if (fs.existsSync(source)) {
          if (fs.existsSync(dest)) {
            if (fs.statSync(dest).isDirectory()) {
              fs.rmSync(dest, { recursive: true });
            } else {
              fs.unlinkSync(dest);
            }
          }
          
          if (fs.statSync(source).isDirectory()) {
            copyDirectory(source, dest);
          } else {
            fs.copyFileSync(source, dest);
          }
        }
      }
      
      Logger.info(`[UpdateService] Restored from backup: ${backupPath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    Logger.error('[UpdateService] Failed to restore from backup:', error);
    return false;
  }
};

/**
 * Checks for updates
 */
export const checkForUpdates = async (): Promise<{ available: boolean; version?: string; releaseNotes?: string }> => {
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const updateInfo = await autoUpdater.checkForUpdates();
      
      if (updateInfo && updateInfo.updateInfo) {
        return {
          available: true,
          version: updateInfo.updateInfo.version,
          releaseNotes: updateInfo.updateInfo.releaseNotes,
        };
      }
    }
    
    return { available: false };
  } catch (error) {
    Logger.error('[UpdateService] Failed to check for updates:', error);
    return { available: false };
  }
};

/**
 * Downloads update
 */
export const downloadUpdate = async (onProgress?: (progress: number) => void): Promise<boolean> => {
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      // Create backup before update
      const backupPath = await createUpdateBackup();
      
      if (backupPath) {
        const history = await getUpdateHistory();
        const currentVersion = await PlatformService.getVersion();
        
        await saveUpdateHistory({
          version: currentVersion,
          releaseDate: Date.now(),
          installed: false,
          rolledBack: false,
        });
      }
      
      // Download update
      autoUpdater.on('download-progress', (progressObj) => {
        const percent = Math.round(progressObj.percent);
        if (onProgress) {
          onProgress(percent);
        }
      });
      
      await autoUpdater.downloadUpdate();
      
      return true;
    }
    
    return false;
  } catch (error) {
    Logger.error('[UpdateService] Failed to download update:', error);
    return false;
  }
};

/**
 * Installs update
 */
export const installUpdate = async (): Promise<boolean> => {
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      await autoUpdater.quitAndInstall();
      return true;
    }
    
    return false;
  } catch (error) {
    Logger.error('[UpdateService] Failed to install update:', error);
    return false;
  }
};

/**
 * Rolls back to previous version
 */
export const rollbackUpdate = async (): Promise<boolean> => {
  try {
    const history = await getUpdateHistory();
    const lastUpdate = history.find(u => u.installed && !u.rolledBack);
    
    if (!lastUpdate) {
      Logger.warn('[UpdateService] No update to rollback');
      return false;
    }
    
    // Find backup for this version
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const { app } = require('electron');
      const userData = app.getPath('userData');
      const backupDir = path.join(userData, BACKUP_DIR);
      
      if (fs.existsSync(backupDir)) {
        const backups = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('backup-'))
          .sort()
          .reverse();
        
        if (backups.length > 0) {
          const backupPath = path.join(backupDir, backups[0]);
          const restored = await restoreFromBackup(backupPath);
          
          if (restored) {
            // Mark as rolled back
            lastUpdate.rolledBack = true;
            await saveUpdateHistory(lastUpdate);
            
            Logger.info('[UpdateService] Update rolled back successfully');
            return true;
          }
        }
      }
    }
    
    return false;
  } catch (error) {
    Logger.error('[UpdateService] Failed to rollback update:', error);
    return false;
  }
};

