import { User, UserRole, Permission } from '../types';

/**
 * Permission Service
 * Handles role-based access control (RBAC) and permission checking
 */

// Base permissions for each role (excluding Owner)
// Owner automatically inherits ALL Admin permissions + any additional Owner-specific ones
const BASE_ROLE_PERMISSIONS: Record<Exclude<UserRole, UserRole.OWNER>, Permission[]> = {
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

// Owner-specific additional permissions (beyond Admin)
// These are permissions that only Owner should have
const OWNER_SPECIFIC_PERMISSIONS: Permission[] = [
  // Add any Owner-only permissions here in the future
  // For now, Owner gets everything Admin has automatically
];

/**
 * Gets base permissions for a role (excluding Owner)
 */
const getBaseRolePermissions = (role: Exclude<UserRole, UserRole.OWNER>): Permission[] => {
  return BASE_ROLE_PERMISSIONS[role] || [];
};

/**
 * Gets all Admin permissions (used for Owner inheritance)
 */
const getAdminPermissions = (): Permission[] => {
  return getBaseRolePermissions(UserRole.ADMIN);
};

/**
 * Gets permissions for Owner role
 * Owner automatically inherits ALL Admin permissions + Owner-specific permissions
 */
const getOwnerPermissions = (): Permission[] => {
  const adminPerms = getAdminPermissions();
  const ownerPerms = [...adminPerms, ...OWNER_SPECIFIC_PERMISSIONS];
  // Remove duplicates
  return Array.from(new Set(ownerPerms));
};

/**
 * Gets all permissions for a user based on their role and explicit permissions
 * Owner automatically inherits ALL Admin permissions + any Owner-specific permissions
 */
export const getUserPermissions = (user: User): Permission[] => {
  // Owner automatically gets all Admin permissions + Owner-specific permissions
  if (user.role === UserRole.OWNER) {
    return getOwnerPermissions();
  }
  
  // If user has explicit permissions, use those (allows for custom permissions)
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions;
  }
  
  // Otherwise, use role-based permissions
  if (user.role === UserRole.ADMIN) {
    return getAdminPermissions();
  }
  
  return getBaseRolePermissions(user.role as Exclude<UserRole, UserRole.OWNER>) || [];
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
 * Owner automatically has admin access (inherits from Admin)
 */
export const hasAdminAccess = (user: User): boolean => {
  // Owner automatically has all Admin permissions, including ADMIN_ACCESS
  if (user.role === UserRole.OWNER) {
    return true;
  }
  return checkPermission(user, Permission.ADMIN_ACCESS) || 
         user.role === UserRole.ADMIN;
};

/**
 * Requires admin access, throws error if user doesn't have it
 * Owner automatically has admin access (inherits from Admin)
 */
export const requireAdminAccess = (user: User): void => {
  if (!hasAdminAccess(user)) {
    throw new Error('Admin access required. This action is restricted to administrators and owners.');
  }
};

/**
 * Checks if a user can manage API keys
 * Owner automatically has this permission (inherits from Admin)
 */
export const canManageApiKeys = (user: User): boolean => {
  return checkPermission(user, Permission.API_KEY_MANAGE) || 
         hasAdminAccess(user);
};

/**
 * Checks if a user can manage settings
 * Owner automatically has this permission (inherits from Admin)
 */
export const canManageSettings = (user: User): boolean => {
  return checkPermission(user, Permission.SETTINGS_MANAGE) || 
         hasAdminAccess(user);
};

/**
 * Checks if a user can export data
 * Owner automatically has this permission (inherits from Admin)
 */
export const canExportData = (user: User): boolean => {
  return checkPermission(user, Permission.DATA_EXPORT) || 
         hasAdminAccess(user);
};

/**
 * Checks if a user can view audit logs
 * Owner automatically has this permission (inherits from Admin)
 */
export const canViewAuditLogs = (user: User): boolean => {
  return checkPermission(user, Permission.AUDIT_VIEW) || 
         hasAdminAccess(user);
};

/**
 * Checks if a user can delete resources
 * Owner automatically has this permission (inherits from Admin)
 */
export const canDelete = (user: User): boolean => {
  return checkPermission(user, Permission.DELETE) || 
         hasAdminAccess(user);
};

/**
 * Checks if a user can write/modify resources
 * Owner automatically has this permission (inherits from Admin)
 */
export const canWrite = (user: User): boolean => {
  return checkPermission(user, Permission.WRITE) || 
         hasAdminAccess(user);
};

/**
 * Checks if a user can read resources
 */
export const canRead = (user: User): boolean => {
  return checkPermission(user, Permission.READ) || user.role !== undefined; // All users can read
};

/**
 * Checks if a user can manage company configuration
 * Owner automatically has this permission (inherits from Admin)
 */
export const canManageCompanyConfig = (user: User): boolean => {
  return checkPermission(user, Permission.COMPANY_CONFIG_MANAGE) || 
         hasAdminAccess(user);
};

/**
 * Checks if a user can manage products
 * Owner automatically has this permission (inherits from Admin)
 */
export const canManageProducts = (user: User): boolean => {
  return checkPermission(user, Permission.COMPANY_CONFIG_MANAGE) || 
         hasAdminAccess(user);
};

/**
 * Checks if a user can manage pricing
 * Owner automatically has this permission (inherits from Admin)
 */
export const canManagePricing = (user: User): boolean => {
  return checkPermission(user, Permission.COMPANY_CONFIG_MANAGE) || 
         hasAdminAccess(user);
};

/**
 * Checks if a user can send messages
 * Owner automatically has this permission (inherits from Admin)
 * Admin and Sales can also send messages
 */
export const canSendMessages = (user: User): boolean => {
  // Owner automatically has WRITE permission (inherits from Admin)
  if (user.role === UserRole.OWNER) {
    return true;
  }
  return user.role === UserRole.ADMIN || 
         user.role === UserRole.SALES ||
         checkPermission(user, Permission.WRITE);
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
