import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import {
  DEFAULT_TENANT_FEATURE_FLAGS,
  TenantFeatureFlags,
  normalizeTenantFeatureFlags,
  toTenantFeatureFlagsJson,
} from '../tenant/tenant-feature-flags';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

  public async register(dto: RegisterDto) {
    // Transaction creates tenant and owner user
    return this.prisma.$transaction(async (tx) => {
      const slug = this.generateSlug(dto.tenantName);

      const existingTenant = await tx.tenant.findUnique({ where: { slug } });
      if (existingTenant) {
        throw new BadRequestException(
          `Erro no Backend: O nome da empresa já está em uso.`,
        );
      }

      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          slug,
          featureFlags: toTenantFeatureFlagsJson(DEFAULT_TENANT_FEATURE_FLAGS),
        },
      });

      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(dto.password, salt);

      const user = await tx.user.create({
        data: {
          name: dto.userName,
          email: dto.email,
          password: hashedPassword,
          role: UserRole.OWNER,
          tenantId: tenant.id,
        },
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        featureFlags: normalizeTenantFeatureFlags(
          tenant.featureFlags as Partial<TenantFeatureFlags> | null,
        ),
      };
    });
  }

  public async login(dto: LoginDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) {
      throw new UnauthorizedException(
        'Erro no Backend: Credenciais inválidas ou tenant não existe.',
      );
    }

    const user = await this.userService.findByEmailAndTenant(
      dto.email,
      tenant.id,
    );
    if (!user) {
      throw new UnauthorizedException(
        'Erro no Backend: Credenciais inválidas.',
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException(
        'Erro no Backend: Credenciais inválidas.',
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    return {
      access_token: this.jwtService.sign(payload),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      featureFlags: normalizeTenantFeatureFlags(
        tenant.featureFlags as Partial<TenantFeatureFlags> | null,
      ),
      workspace: {
        id: tenant.id,
        name: 'Workspace principal',
        slug: 'principal',
      },
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
}
