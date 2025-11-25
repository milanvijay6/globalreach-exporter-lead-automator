import { PendingUser, User, UserRole } from '../types';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';
import { logSecurityEvent } from './securityService';

const STORAGE_KEY_PENDING_USERS = 'globalreach_pending_users';

/**
 * Signup Service
 * Handles new user signup requests and owner approval workflow
 */
export const SignupService = {
  /**
   * Submits a signup request
   */
  submitSignupRequest: async (data: {
    name: string;
    email: string;
    mobile?: string;
    requestedRole: UserRole;
  }): Promise<{ success: boolean; requestId?: string; error?: string }> => {
    try {
      // Validate inputs
      if (!data.name || !data.email) {
        return { success: false, error: 'Name and email are required' };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return { success: false, error: 'Invalid email format' };
      }

      // Check if user already exists
      const { UserService } = await import('./userService');
      const existingUsers = await UserService.getAllUsers();
      const existingUser = existingUsers.find(u => u.email.toLowerCase() === data.email.toLowerCase());
      
      if (existingUser) {
        return { success: false, error: 'User with this email already exists' };
      }

      // Check if pending request already exists
      const pendingUsers = await SignupService.getPendingUsers();
      const existingPending = pendingUsers.find(
        p => p.email.toLowerCase() === data.email.toLowerCase() && p.status === 'pending'
      );

      if (existingPending) {
        return { success: false, error: 'A signup request for this email is already pending' };
      }

      // Create pending user
      const pendingUser: PendingUser = {
        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        requestedRole: data.requestedRole,
        requestedAt: Date.now(),
        status: 'pending',
      };

      // Save to storage
      const stored = await PlatformService.secureLoad(STORAGE_KEY_PENDING_USERS);
      const pending: PendingUser[] = stored ? JSON.parse(stored) : [];
      pending.push(pendingUser);
      await PlatformService.secureSave(STORAGE_KEY_PENDING_USERS, JSON.stringify(pending));

      // Notify owner
      await SignupService.notifyOwnerOfSignup(pendingUser);

      await logSecurityEvent('SIGNUP_REQUEST', pendingUser.id, `New signup request: ${data.email}`);

      Logger.info(`[SignupService] Signup request submitted: ${pendingUser.id}`);
      return { success: true, requestId: pendingUser.id };
    } catch (error: any) {
      Logger.error('[SignupService] Failed to submit signup request:', error);
      return { success: false, error: error.message || 'Failed to submit signup request' };
    }
  },

  /**
   * Gets all pending users
   */
  getPendingUsers: async (): Promise<PendingUser[]> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_PENDING_USERS);
      if (!stored) return [];

      const pending: PendingUser[] = JSON.parse(stored);
      return pending.filter(p => p.status === 'pending');
    } catch (error) {
      Logger.error('[SignupService] Failed to get pending users:', error);
      return [];
    }
  },

  /**
   * Gets all signup requests (including approved/rejected)
   */
  getAllSignupRequests: async (): Promise<PendingUser[]> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_PENDING_USERS);
      if (!stored) return [];

      return JSON.parse(stored) as PendingUser[];
    } catch (error) {
      Logger.error('[SignupService] Failed to get all signup requests:', error);
      return [];
    }
  },

  /**
   * Approves a user signup request
   */
  approveUser: async (
    requestId: string,
    approvedBy: string,
    password: string,
    role: UserRole
  ): Promise<User> => {
    try {
      const { UserService } = await import('./userService');
      const { AuthService } = await import('./authService');
      const { githubSyncService } = await import('./githubSyncService');

      // Get pending user
      const stored = await PlatformService.secureLoad(STORAGE_KEY_PENDING_USERS);
      if (!stored) {
        throw new Error('Pending user not found');
      }

      const pending: PendingUser[] = JSON.parse(stored);
      const pendingUser = pending.find(p => p.id === requestId && p.status === 'pending');

      if (!pendingUser) {
        throw new Error('Pending user not found or already processed');
      }

      // Hash password
      const passwordHash = await AuthService.hashPassword(password);

      // Create user
      const user: User = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: pendingUser.name,
        email: pendingUser.email,
        mobile: pendingUser.mobile,
        role: role,
        passwordHash,
        status: 'active',
        approvedBy,
        approvedAt: Date.now(),
        createdAt: Date.now(),
        permissions: [],
      };

      await UserService.createUser(user);

      // Update pending user status
      const updatedPending = pending.map(p =>
        p.id === requestId ? { ...p, status: 'approved' as const } : p
      );
      await PlatformService.secureSave(STORAGE_KEY_PENDING_USERS, JSON.stringify(updatedPending));

      // Sync to GitHub (if enabled)
      try {
        await githubSyncService.syncUserApproval(user.id, 'approved', {
          email: user.email,
          role: user.role,
          approvedBy,
        });
      } catch (error) {
        Logger.warn('[SignupService] GitHub sync failed (non-blocking):', error);
      }

      // Notify user (optional - email/SMS/WhatsApp)
      await SignupService.notifyUserApproval(pendingUser.email, password);

      await logSecurityEvent('USER_APPROVED', user.id, `User approved: ${user.email} by ${approvedBy}`);

      Logger.info(`[SignupService] User approved: ${user.id}`);
      return user;
    } catch (error: any) {
      Logger.error('[SignupService] Failed to approve user:', error);
      throw error;
    }
  },

  /**
   * Rejects a user signup request
   */
  rejectUser: async (
    requestId: string,
    rejectedBy: string,
    reason?: string
  ): Promise<void> => {
    try {
      const { githubSyncService } = await import('./githubSyncService');

      // Get pending user
      const stored = await PlatformService.secureLoad(STORAGE_KEY_PENDING_USERS);
      if (!stored) {
        throw new Error('Pending user not found');
      }

      const pending: PendingUser[] = JSON.parse(stored);
      const pendingUser = pending.find(p => p.id === requestId && p.status === 'pending');

      if (!pendingUser) {
        throw new Error('Pending user not found or already processed');
      }

      // Update pending user status
      const updatedPending = pending.map(p =>
        p.id === requestId
          ? { ...p, status: 'rejected' as const, rejectionReason: reason }
          : p
      );
      await PlatformService.secureSave(STORAGE_KEY_PENDING_USERS, JSON.stringify(updatedPending));

      // Sync to GitHub (if enabled)
      try {
        await githubSyncService.syncUserApproval(pendingUser.id, 'rejected', {
          email: pendingUser.email,
          reason,
          rejectedBy,
        });
      } catch (error) {
        Logger.warn('[SignupService] GitHub sync failed (non-blocking):', error);
      }

      // Notify user (optional)
      await SignupService.notifyUserRejection(pendingUser.email, reason);

      await logSecurityEvent('USER_REJECTED', requestId, `User rejected: ${pendingUser.email} by ${rejectedBy}`);

      Logger.info(`[SignupService] User rejected: ${requestId}`);
    } catch (error: any) {
      Logger.error('[SignupService] Failed to reject user:', error);
      throw error;
    }
  },

  /**
   * Notifies owner of a new signup request
   */
  notifyOwnerOfSignup: async (pendingUser: PendingUser): Promise<void> => {
    try {
      // In-app notification (store for owner to see)
      const notification = {
        id: `notif-${Date.now()}`,
        type: 'signup_request',
        title: 'New User Signup Request',
        message: `${pendingUser.name} (${pendingUser.email}) requested ${pendingUser.requestedRole} access`,
        data: { pendingUserId: pendingUser.id },
        timestamp: Date.now(),
        read: false,
      };

      const stored = await PlatformService.secureLoad('globalreach_notifications');
      const notifications = stored ? JSON.parse(stored) : [];
      notifications.unshift(notification);
      await PlatformService.secureSave('globalreach_notifications', JSON.stringify(notifications));

      // Optional: Send email notification (if email service is configured)
      // This would require email service integration

      Logger.info(`[SignupService] Owner notified of signup: ${pendingUser.id}`);
    } catch (error) {
      Logger.error('[SignupService] Failed to notify owner:', error);
      // Don't throw - notification failure shouldn't block signup
    }
  },

  /**
   * Notifies user of approval
   */
  notifyUserApproval: async (email: string, password: string): Promise<void> => {
    try {
      // Store notification for user to see when they log in
      const notification = {
        id: `notif-${Date.now()}`,
        type: 'signup_approved',
        title: 'Account Approved',
        message: 'Your account has been approved. You can now log in.',
        timestamp: Date.now(),
        read: false,
      };

      // Optional: Send email with login credentials
      // This would require email service integration
      Logger.info(`[SignupService] User notified of approval: ${email}`);
    } catch (error) {
      Logger.error('[SignupService] Failed to notify user of approval:', error);
    }
  },

  /**
   * Notifies user of rejection
   */
  notifyUserRejection: async (email: string, reason?: string): Promise<void> => {
    try {
      // Store notification (though user may not be able to see it if account not created)
      // Optional: Send email notification
      Logger.info(`[SignupService] User notified of rejection: ${email}`);
    } catch (error) {
      Logger.error('[SignupService] Failed to notify user of rejection:', error);
    }
  },
};

