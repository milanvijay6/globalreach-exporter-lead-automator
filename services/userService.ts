import { User } from '../types';
import { loadUserSession, saveUserSession } from './securityService';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';

const STORAGE_KEY_USERS = 'globalreach_users';

/**
 * User Service
 * Handles user data management and persistence
 */

/**
 * Gets a user by ID
 */
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    // First check if it's the current session user
    const currentUser = await loadUserSession();
    if (currentUser && currentUser.id === userId) {
      return currentUser;
    }
    
    // Otherwise, load from users storage
    const stored = await PlatformService.secureLoad(STORAGE_KEY_USERS);
    if (!stored) return null;
    
    const users: User[] = JSON.parse(stored);
    return users.find(u => u.id === userId) || null;
  } catch (error) {
    Logger.error('[UserService] Failed to get user:', error);
    return null;
  }
};

/**
 * Updates a user
 */
export const updateUser = async (userId: string, updates: Partial<User>): Promise<User | null> => {
  try {
    const user = await getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    const updatedUser: User = {
      ...user,
      ...updates,
      id: user.id, // Preserve ID
    };
    
    // Update in users storage
    const stored = await PlatformService.secureLoad(STORAGE_KEY_USERS);
    let users: User[] = stored ? JSON.parse(stored) : [];
    
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
    } else {
      users.push(updatedUser);
    }
    
    await PlatformService.secureSave(STORAGE_KEY_USERS, JSON.stringify(users));
    
    // If this is the current session user, update session
    const currentUser = await loadUserSession();
    if (currentUser && currentUser.id === userId) {
      await saveUserSession(updatedUser);
    }
    
    Logger.info(`[UserService] Updated user ${userId}`);
    
    return updatedUser;
  } catch (error) {
    Logger.error('[UserService] Failed to update user:', error);
    throw error;
  }
};

/**
 * Gets all users (admin only)
 */
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_USERS);
    if (!stored) return [];
    
    return JSON.parse(stored) as User[];
  } catch (error) {
    Logger.error('[UserService] Failed to get all users:', error);
    return [];
  }
};

/**
 * Creates a new user
 */
export const createUser = async (user: User): Promise<User> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_USERS);
    const users: User[] = stored ? JSON.parse(stored) : [];
    
    // Check if user already exists
    if (users.find(u => u.id === user.id)) {
      throw new Error(`User ${user.id} already exists`);
    }
    
    users.push(user);
    await PlatformService.secureSave(STORAGE_KEY_USERS, JSON.stringify(users));
    
    Logger.info(`[UserService] Created user ${user.id}`);
    
    return user;
  } catch (error) {
    Logger.error('[UserService] Failed to create user:', error);
    throw error;
  }
};

/**
 * Deletes a user
 */
export const deleteUser = async (userId: string): Promise<boolean> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_USERS);
    if (!stored) return false;
    
    const users: User[] = JSON.parse(stored);
    const filteredUsers = users.filter(u => u.id !== userId);
    
    if (filteredUsers.length === users.length) {
      return false; // User not found
    }
    
    await PlatformService.secureSave(STORAGE_KEY_USERS, JSON.stringify(filteredUsers));
    
    Logger.info(`[UserService] Deleted user ${userId}`);
    
    return true;
  } catch (error) {
    Logger.error('[UserService] Failed to delete user:', error);
    return false;
  }
};

export const UserService = {
  getUser,
  updateUser,
  getAllUsers,
  createUser,
  deleteUser,
};

