import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Company, Prisma } from '@prisma/client';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    tenantId: string,
    dto: CreateCompanyDto,
  ): Promise<Company> {
    return this.prisma.company.create({
      data: {
        name: dto.name,
        industry: dto.industry,
        website: dto.website,
        tenantId,
      },
    });
  }

  public async findAll(tenantId: string, search?: string): Promise<any[]> {
    const whereClause: any = { tenantId };

    if (search) {
      whereClause.name = { contains: search, mode: 'insensitive' };
    }

    return this.prisma.company.findMany({
      where: whereClause,
      include: {
        contacts: true, // Inclui os contatos vinculados
      },
      orderBy: { name: 'asc' },
    });
  }

  public async findOne(tenantId: string, id: string): Promise<Company> {
    const company = await this.prisma.company.findFirst({
      where: { id, tenantId },
      include: {
        contacts: true,
      },
    });

    if (!company) {
      throw new NotFoundException(
        `Erro no Backend: Empresa com ID '${id}' não encontrada neste tenant.`,
      );
    }

    return company;
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdateCompanyDto,
  ): Promise<Company> {
    await this.findOne(tenantId, id); // Garantir que existe e pertence ao tenant

    return this.prisma.company.update({
      where: { id },
      data: { ...dto },
    });
  }

  public async remove(tenantId: string, id: string): Promise<Company> {
    await this.findOne(tenantId, id);

    return this.prisma.company.delete({
      where: { id },
    });
  }
}
