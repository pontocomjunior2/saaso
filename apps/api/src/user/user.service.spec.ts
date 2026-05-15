import { BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('UserService', () => {
  let service: UserService;
  const prisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService(prisma);
  });

  it('creates a non-admin user within the current tenant', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockImplementation(async (args) => ({
      id: 'user-1',
      name: args.data.name,
      email: args.data.email,
      role: args.data.role,
      tenantId: args.data.tenantId,
      createdAt: new Date('2026-05-15T12:00:00.000Z'),
      updatedAt: new Date('2026-05-15T12:00:00.000Z'),
    }));

    const createdUser = await service.createTenantUser('tenant-1', {
      name: 'Operador 1',
      email: 'operador@empresa.com',
      password: 'secret123',
      role: UserRole.AGENT,
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Operador 1',
          email: 'operador@empresa.com',
          role: UserRole.AGENT,
          tenantId: 'tenant-1',
          password: expect.any(String),
        }),
      }),
    );
    expect(createdUser).toEqual(
      expect.objectContaining({
        email: 'operador@empresa.com',
        role: UserRole.AGENT,
        tenantId: 'tenant-1',
      }),
    );
  });

  it('rejects duplicate emails within the same tenant', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-user',
    });

    await expect(
      service.createTenantUser('tenant-1', {
        name: 'Gestor',
        email: 'gestor@empresa.com',
        password: 'secret123',
        role: UserRole.MANAGER,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects admin and owner roles in the internal registration flow', async () => {
    await expect(
      service.createTenantUser('tenant-1', {
        name: 'Admin indevido',
        email: 'admin@empresa.com',
        password: 'secret123',
        role: UserRole.ADMIN as UserRole.MANAGER,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists users only from the requested tenant', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    await service.listTenantUsers('tenant-1');

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
      }),
    );
  });
});
