import { User, UserRole, Permission } from '../types';

/**
 * Permission Service
 * Handles role-based access control (RBAC) and permission checking
 */

// Default permissions for each role
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    // Owner has ALL permissions - full access to everything
    Permission.READ,
    Permission.WRITE,
    Permission.DELETE,
    Permission.ADMIN_ACCESS,
    Permission.API_KEY_MANAGE,
    Permission.SETTINGS_MANAGE,
    Permission.DATA_EXPORT,
    Permission.AUDIT_VIEW,
    Permission.COMPANY_CONFIG_MANAGE,
  ],
  [UserRole.ADMIN]: [
    Permission.READ,
    Permission.WRITE,
    Permission.DELETE,
    Permission.ADMIN_ACCESS,
    Permission.API_KEY_MANAGE,
    Permission.SETTINGS_MANAGE,
    Permission.DATA_EXPORT,
    Permission.AUDIT_VIEW,
    Permission.COMPANY_CONFIG_MANAGE,
  ],
  [UserRole.SALES]: [
    Permission.READ,
    Permission.WRITE,
  ],
  [UserRole.VIEWER]: [
    Permission.READ,
  ],
};

/**
 * Gets all permissions for a user based on their role and explicit permissions
 */
export const getUserPermissions = (user: User): Permission[] => {
  // Owner always has ALL permissions
  if (user.role === UserRole.OWNER) {
    return Object.values(Permission);
  }
  
  // If user has explicit permissions, use those (allows for custom permissions)
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions;
  }
  
  // Otherwise, use role-based permissions
  return ROLE_PERMISSIONS[user.role] || [];
};

/**
 * Checks if a user has a specific permission
 */
export const checkPermission = (user: User, permission: Permission): boolean => {
  const userPermissions = getUserPermissions(user);
  return userPermissions.includes(permission);
};

/**
 * Checks if a user has admin access
 */
export const hasAdminAccess = (user: User): boolean => {
  return checkPermission(user, Permission.ADMIN_ACCESS) || 
         user.role === UserRole.ADMIN || 
         user.role === UserRole.OWNER;
};

/**
 * Requires admin access, throws error if user doesn't have it
 */
export const requireAdminAccess = (user: User): void => {
  if (!hasAdminAccess(user)) {
    throw new Error('Admin access required. This action is restricted to administrators.');
  }
};

/**
 * Checks if a user can manage API keys
 */
export const canManageApiKeys = (user: User): boolean => {
  return checkPermission(user, Permission.API_KEY_MANAGE) || 
         hasAdminAccess(user) || 
         user.role === UserRole.OWNER;
};

/**
 * Checks if a user can manage settings
 */
export const canManageSettings = (user: User): boolean => {
  return checkPermission(user, Permission.SETTINGS_MANAGE) || 
         hasAdminAccess(user) || 
         user.role === UserRole.OWNER;
};

/**
 * Checks if a user can export data
 */
export const canExportData = (user: User): boolean => {
  return checkPermission(user, Permission.DATA_EXPORT) || 
         hasAdminAccess(user) || 
         user.role === UserRole.OWNER;
};

/**
 * Checks if a user can view audit logs
 */
export const canViewAuditLogs = (user: User): boolean => {
  return checkPermission(user, Permission.AUDIT_VIEW) || 
         hasAdminAccess(user) || 
         user.role === UserRole.OWNER;
};

/**
 * Checks if a user can delete resources
 */
export const canDelete = (user: User): boolean => {
  return checkPermission(user, Permission.DELETE) || 
         hasAdminAccess(user) || 
         user.role === UserRole.OWNER;
};

/**
 * Checks if a user can write/modify resources
 */
export const canWrite = (user: User): boolean => {
  return checkPermission(user, Permission.WRITE) || 
         hasAdminAccess(user) || 
         user.role === UserRole.OWNER;
};

/**
 * Checks if a user can read resources
 */
export const canRead = (user: User): boolean => {
  return checkPermission(user, Permission.READ) || user.role !== undefined; // All users can read
};

/**
 * Checks if a user can manage company configuration
 */
export const canManageCompanyConfig = (user: User): boolean => {
  return checkPermission(user, Permission.COMPANY_CONFIG_MANAGE) || 
         hasAdminAccess(user) || 
         user.role === UserRole.OWNER;
};

/**
 * Checks if a user can manage products
 */
export const canManageProducts = (user: User): boolean => {
  return checkPermission(user, Permission.COMPANY_CONFIG_MANAGE) || 
         hasAdminAccess(user) || 
         user.role === UserRole.OWNER;
};

/**
 * Checks if a user can manage pricing
 */
export const canManagePricing = (user: User): boolean => {
  return checkPermission(user, Permission.COMPANY_CONFIG_MANAGE) || 
         hasAdminAccess(user) || 
         user.role === UserRole.OWNER;
};

/**
 * Checks if a user is the owner
 */
export const isOwner = (user: User): boolean => {
  return user.role === UserRole.OWNER;
};

/**
 * Owner has all permissions - this is a convenience check
 */
export const hasOwnerAccess = (user: User): boolean => {
  return user.role === UserRole.OWNER;
};
