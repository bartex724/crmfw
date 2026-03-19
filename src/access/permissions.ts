export const PERMISSIONS = {
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  EVENTS_READ: 'events:read',
  EVENTS_WRITE: 'events:write',
  BOXES_READ: 'boxes:read',
  BOXES_WRITE: 'boxes:write',
  EXPORTS_READ: 'exports:read'
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
