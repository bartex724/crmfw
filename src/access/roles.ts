export const ROLES = ['ADMIN', 'WAREHOUSE_STAFF', 'OFFICE_STAFF', 'GUEST'] as const;

export type RoleCode = (typeof ROLES)[number];

export function isRoleCode(value: string): value is RoleCode {
  return ROLES.includes(value as RoleCode);
}
