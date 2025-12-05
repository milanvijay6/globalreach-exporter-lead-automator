import { User, UserRole } from '../types';
import { loadUserSession, saveUserSession } from './securityService';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';

const STORAGE_KEY_USERS = 'globalreach_users';

/**
 * User Service
 * Handles user data management and persistence
 */

/**
 * Helper function to check if current user can access owner users
 */
const canAccessOwnerUser = (currentUser: User | null): boolean => {
  return currentUser?.role === UserRole.OWNER;
};

/**
 * Gets a user by ID
 */
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    // Load current user session to check permissions
    const currentUser = await loadUserSession();
    
    // First check if it's the current session user - always allow users to see themselves
    if (currentUser && currentUser.id === userId) {
      return currentUser;
    }
    
    // Otherwise, load from users storage
    const stored = await PlatformService.secureLoad(STORAGE_KEY_USERS);
    if (!stored) return null;
    
    const users: User[] = JSON.parse(stored);
    const targetUser = users.find(u => u.id === userId) || null;
    
    // If target user is owner and current user is not owner, return null
    if (targetUser && targetUser.role === UserRole.OWNER && !canAccessOwnerUser(currentUser)) {
      Logger.warn(`[UserService] Non-owner user attempted to access owner user: ${userId}`);
      return null;
    }
    
    return targetUser;
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
    // Load current user session to check permissions
    const currentUser = await loadUserSession();
    
    // Load target user directly from storage (bypass getUser to check role)
    const stored = await PlatformService.secureLoad(STORAGE_KEY_USERS);
    if (!stored) {
      throw new Error(`User ${userId} not found`);
    }
    
    const users: User[] = JSON.parse(stored);
    const targetUser = users.find(u => u.id === userId);
    
    if (!targetUser) {
      throw new Error(`User ${userId} not found`);
    }
    
    // Check if user is trying to update themselves - always allow
    const isUpdatingSelf = currentUser && currentUser.id === userId;
    
    // If target user is owner and current user is not owner (and not updating self), block update
    if (targetUser.role === UserRole.OWNER && !isUpdatingSelf && !canAccessOwnerUser(currentUser)) {
      Logger.warn(`[UserService] Non-owner user attempted to update owner user: ${userId}`);
      throw new Error('Cannot modify owner users');
    }
    
    const updatedUser: User = {
      ...targetUser,
      ...updates,
      id: targetUser.id, // Preserve ID
    };
    
    // Update in users storage
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
    } else {
      users.push(updatedUser);
    }
    
    await PlatformService.secureSave(STORAGE_KEY_USERS, JSON.stringify(users));
    
    // If this is the current session user, update session
    if (isUpdatingSelf) {
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
 * Filters out owner users if current user is not owner
 * @param currentUserId - Optional user ID to check permissions. If not provided, loads from session.
 * @param includeOwners - If true, always include owner users (for internal use only)
 */
export const getAllUsers = async (currentUserId?: string, includeOwners: boolean = false): Promise<User[]> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_USERS);
    if (!stored) return [];
    
    const allUsers = JSON.parse(stored) as User[];
    
    // If includeOwners is true (internal use), return all users without filtering
    if (includeOwners) {
      return allUsers;
    }
    
    // If currentUserId provided, check if current user is owner
    if (currentUserId) {
      const currentUser = allUsers.find(u => u.id === currentUserId);
      // If current user is owner, return all users; otherwise filter out owners
      if (currentUser && currentUser.role === UserRole.OWNER) {
        return allUsers;
      } else {
        return allUsers.filter(u => u.role !== UserRole.OWNER);
      }
    }
    
    // If no currentUserId provided, load from session
    const currentUser = await loadUserSession();
    if (canAccessOwnerUser(currentUser)) {
      return allUsers;
    } else {
      return allUsers.filter(u => u.role !== UserRole.OWNER);
    }
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

