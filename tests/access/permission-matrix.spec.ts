import { PERMISSIONS } from '../../src/access/permissions';
import { ROLE_PERMISSION_MATRIX } from '../../src/access/role-permission.matrix';
import { ROLES } from '../../src/access/roles';

describe('Permission matrix contract', () => {
  it('exports exactly ADMIN, WAREHOUSE_STAFF, OFFICE_STAFF, GUEST roles', () => {
    expect(ROLES).toEqual(['ADMIN', 'WAREHOUSE_STAFF', 'OFFICE_STAFF', 'GUEST']);
  });

  it('matches locked role decisions and denies guest export access', () => {
    expect(ROLE_PERMISSION_MATRIX.ADMIN).toEqual(
      expect.arrayContaining([
        PERMISSIONS.USERS_MANAGE,
        PERMISSIONS.ROLES_MANAGE,
        PERMISSIONS.INVENTORY_READ,
        PERMISSIONS.INVENTORY_WRITE,
        PERMISSIONS.EVENTS_READ,
        PERMISSIONS.EVENTS_WRITE,
        PERMISSIONS.BOXES_READ,
        PERMISSIONS.BOXES_WRITE,
        PERMISSIONS.EXPORTS_READ
      ])
    );

    expect(ROLE_PERMISSION_MATRIX.WAREHOUSE_STAFF).toEqual([
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_WRITE,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.EVENTS_WRITE,
      PERMISSIONS.BOXES_READ,
      PERMISSIONS.BOXES_WRITE,
      PERMISSIONS.EXPORTS_READ
    ]);

    expect(ROLE_PERMISSION_MATRIX.OFFICE_STAFF).toEqual([
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.EVENTS_WRITE,
      PERMISSIONS.BOXES_READ,
      PERMISSIONS.EXPORTS_READ
    ]);

    expect(ROLE_PERMISSION_MATRIX.GUEST).toEqual([
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.BOXES_READ
    ]);
    expect(ROLE_PERMISSION_MATRIX.GUEST).not.toContain(PERMISSIONS.EXPORTS_READ);
  });
});
