import { User, UserRole } from '../types';
import { UserService } from './userService';
import { AuthService } from './authService';
import { PinService } from './pinService';
import { Logger } from './loggerService';
import { logAdminAction } from './auditService';

/**
 * User Management Service
 * Handles user creation, status updates, and password/PIN resets by admins
 */
export const UserManagementService = {
  /**
   * Creates a new user (admin/owner only)
   */
  createUser: async (
    creatorId: string,
    userData: {
      name: string;
      email: string;
      password: string;
      role: UserRole;
      mobile?: string;
    }
  ): Promise<User> => {
    try {
      const creator = await UserService.getUser(creatorId);
      if (!creator) {
        throw new Error('Creator not found');
      }

      // Check permissions (admin or owner can create users)
      if (creator.role !== 'Admin' && creator.role !== 'Owner') {
        throw new Error('Insufficient permissions to create users');
      }

      // Check if user already exists
      const existingUsers = await UserService.getAllUsers();
      const existing = existingUsers.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
      if (existing) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await AuthService.hashPassword(userData.password);

      // Create user (active immediately for admin-created users)
      const user: User = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: userData.name,
        email: userData.email,
        mobile: userData.mobile,
        role: userData.role,
        passwordHash,
        status: 'active',
        createdBy: creatorId,
        createdAt: Date.now(),
        permissions: [],
      };

      await UserService.createUser(user);

      await logAdminAction(creator, 'user_create', 'user', {
        createdUserId: user.id,
        createdUserEmail: user.email,
        role: user.role,
      });

      Logger.info(`[UserManagementService] User created: ${user.id} by ${creatorId}`);
      return user;
    } catch (error: any) {
      Logger.error('[UserManagementService] Failed to create user:', error);
      throw error;
    }
  },

  /**
   * Updates user status
   */
  updateUserStatus: async (
    userId: string,
    status: 'active' | 'suspended',
    updaterId: string
  ): Promise<void> => {
    try {
      const updater = await UserService.getUser(updaterId);
      if (!updater) {
        throw new Error('Updater not found');
      }

      // Check permissions
      if (updater.role !== 'Admin' && updater.role !== 'Owner') {
        throw new Error('Insufficient permissions');
      }

      await UserService.updateUser(userId, { status });

      await logAdminAction(updater, 'user_status_update', 'user', {
        targetUserId: userId,
        newStatus: status,
      });

      Logger.info(`[UserManagementService] User status updated: ${userId} to ${status}`);
    } catch (error: any) {
      Logger.error('[UserManagementService] Failed to update user status:', error);
      throw error;
    }
  },

  /**
   * Resets a user's password (admin/owner only)
   */
  resetUserPassword: async (
    userId: string,
    newPassword: string,
    resetterId: string
  ): Promise<void> => {
    try {
      const resetter = await UserService.getUser(resetterId);
      if (!resetter) {
        throw new Error('Resetter not found');
      }

      // Check permissions
      if (resetter.role !== 'Admin' && resetter.role !== 'Owner') {
        throw new Error('Insufficient permissions to reset password');
      }

      const passwordHash = await AuthService.hashPassword(newPassword);
      await UserService.updateUser(userId, { passwordHash });

      await logAdminAction(resetter, 'password_reset', 'user', {
        targetUserId: userId,
      });

      Logger.info(`[UserManagementService] Password reset for user: ${userId}`);
    } catch (error: any) {
      Logger.error('[UserManagementService] Failed to reset password:', error);
      throw error;
    }
  },

  /**
   * Resets a user's PIN (admin/owner only)
   */
  resetUserPin: async (
    userId: string,
    resetterId: string,
    resetterPassword: string
  ): Promise<void> => {
    try {
      await PinService.resetPin(userId, resetterId, resetterPassword);
      Logger.info(`[UserManagementService] PIN reset for user: ${userId}`);
    } catch (error: any) {
      Logger.error('[UserManagementService] Failed to reset PIN:', error);
      throw error;
    }
  },
};

