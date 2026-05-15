import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';

const USER_SUMMARY_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const MANAGEABLE_USER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.AGENT];

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  public async createTenantUser(tenantId: string, dto: CreateUserDto) {
    if (!MANAGEABLE_USER_ROLES.includes(dto.role)) {
      throw new BadRequestException(
        'Erro no Backend: Apenas usuários não-admin podem ser cadastrados por este fluxo.',
      );
    }

    const existingUser = await this.findByEmailAndTenant(dto.email, tenantId);
    if (existingUser) {
      throw new BadRequestException(
        `Erro no Backend: O usuário com e-mail '${dto.email}' já existe neste tenant.`,
      );
    }

    const hashedPassword = await this.hashPassword(dto.password);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
        tenantId,
      },
      select: USER_SUMMARY_SELECT,
    });
  }

  public async findByEmailAndTenant(
    email: string,
    tenantId: string,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId,
        },
      },
    });
  }

  public async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  public async listTenantUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'asc' }],
      select: USER_SUMMARY_SELECT,
    });
  }

  private async hashPassword(password: string) {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
  }
}
