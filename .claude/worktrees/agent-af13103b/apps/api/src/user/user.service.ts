import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  public async createUser(data: Prisma.UserCreateInput): Promise<User> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: data.email,
        tenantId: data.tenant.connect?.id,
      },
    });

    if (existingUser) {
      throw new BadRequestException(
        `Erro no Backend: O usuário com e-mail '${data.email}' já existe neste tenant.`,
      );
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(data.password, salt);

    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
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
}
