import { PrismaClient, RoleCode } from '@prisma/client';

const prisma = new PrismaClient();

type PermissionSeed = {
  code: string;
  name: string;
  description: string;
};

type RoleSeed = {
  code: RoleCode;
  name: string;
  description: string;
  permissions: string[];
};

const permissionSeeds: PermissionSeed[] = [
  {
    code: 'users:manage',
    name: 'Manage users',
    description: 'Create, disable, enable, and update users.'
  },
  {
    code: 'roles:manage',
    name: 'Manage roles',
    description: 'Assign and maintain role mappings.'
  },
  {
    code: 'inventory:read',
    name: 'Read inventory',
    description: 'Read inventory items and stock levels.'
  },
  {
    code: 'inventory:write',
    name: 'Write inventory',
    description: 'Create and modify inventory items.'
  },
  {
    code: 'events:read',
    name: 'Read events',
    description: 'Read event and packing data.'
  },
  {
    code: 'events:write',
    name: 'Write events',
    description: 'Create and modify event and packing data.'
  },
  {
    code: 'boxes:read',
    name: 'Read boxes',
    description: 'Read box definitions and mappings.'
  },
  {
    code: 'boxes:write',
    name: 'Write boxes',
    description: 'Create and modify box definitions and mappings.'
  },
  {
    code: 'exports:read',
    name: 'Read exports',
    description: 'Generate or download operational exports.'
  }
];

const roleSeeds: RoleSeed[] = [
  {
    code: RoleCode.ADMIN,
    name: 'Admin',
    description: 'Full system access including user and role management.',
    permissions: permissionSeeds.map((permission) => permission.code)
  },
  {
    code: RoleCode.WAREHOUSE_STAFF,
    name: 'Warehouse staff',
    description: 'Operational packing and inventory write access.',
    permissions: [
      'inventory:read',
      'inventory:write',
      'events:read',
      'events:write',
      'boxes:read',
      'boxes:write',
      'exports:read'
    ]
  },
  {
    code: RoleCode.OFFICE_STAFF,
    name: 'Office staff',
    description: 'Planning access with inventory read-only permissions.',
    permissions: ['inventory:read', 'events:read', 'events:write', 'boxes:read', 'exports:read']
  },
  {
    code: RoleCode.GUEST,
    name: 'Guest',
    description: 'Read-only access with no export permissions.',
    permissions: ['inventory:read', 'events:read', 'boxes:read']
  }
];

async function seedPermissions(): Promise<Record<string, string>> {
  const permissionMap: Record<string, string> = {};

  for (const permission of permissionSeeds) {
    const record = await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        description: permission.description
      },
      create: permission
    });

    permissionMap[record.code] = record.id;
  }

  return permissionMap;
}

async function seedRoles(permissionMap: Record<string, string>): Promise<void> {
  for (const role of roleSeeds) {
    const roleRecord = await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description
      }
    });

    const permissionIds = role.permissions.map((permissionCode) => {
      const permissionId = permissionMap[permissionCode];

      if (!permissionId) {
        throw new Error(`Missing permission seed for code: ${permissionCode}`);
      }

      return permissionId;
    });

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: roleRecord.id,
        permissionId: {
          notIn: permissionIds
        }
      }
    });

    for (const permissionId of permissionIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRecord.id,
            permissionId
          }
        },
        update: {},
        create: {
          roleId: roleRecord.id,
          permissionId
        }
      });
    }
  }
}

async function main(): Promise<void> {
  const permissionMap = await seedPermissions();
  await seedRoles(permissionMap);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Prisma seed failed', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
