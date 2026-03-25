import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { Prisma, type KnowledgeBase } from '@prisma/client';

const knowledgeBaseInclude = Prisma.validator<Prisma.KnowledgeBaseInclude>()({
  _count: {
    select: {
      agents: true,
    },
  },
});

type KnowledgeBaseRecord = Prisma.KnowledgeBaseGetPayload<{
  include: typeof knowledgeBaseInclude;
}>;

export interface KnowledgeBaseResponse {
  id: string;
  name: string;
  summary: string | null;
  content: string | null;
  agentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    tenantId: string,
    dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseResponse> {
    const knowledgeBase = await this.prisma.knowledgeBase.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        summary: this.normalizeOptionalText(dto.summary),
        content: dto.content.trim(),
      },
      include: knowledgeBaseInclude,
    });

    return this.mapKnowledgeBaseResponse(knowledgeBase);
  }

  public async findAll(tenantId: string): Promise<KnowledgeBaseResponse[]> {
    const knowledgeBases = await this.prisma.knowledgeBase.findMany({
      where: { tenantId },
      include: knowledgeBaseInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return knowledgeBases.map((knowledgeBase) =>
      this.mapKnowledgeBaseResponse(knowledgeBase),
    );
  }

  public async findOne(
    tenantId: string,
    id: string,
  ): Promise<KnowledgeBaseResponse> {
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: {
        id,
        tenantId,
      },
      include: knowledgeBaseInclude,
    });

    if (!knowledgeBase) {
      throw new NotFoundException(
        `Erro no Backend: Base de conhecimento com ID '${id}' nao encontrada neste tenant.`,
      );
    }

    return this.mapKnowledgeBaseResponse(knowledgeBase);
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseResponse> {
    await this.findOne(tenantId, id);

    const updated = await this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.summary !== undefined
          ? { summary: this.normalizeOptionalText(dto.summary) }
          : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
      },
      include: knowledgeBaseInclude,
    });

    return this.mapKnowledgeBaseResponse(updated);
  }

  public async remove(tenantId: string, id: string): Promise<KnowledgeBase> {
    const knowledgeBase = await this.findOne(tenantId, id);

    if (knowledgeBase.agentCount > 0) {
      throw new BadRequestException(
        'Erro no Backend: Remova a base dos agentes vinculados antes de exclui-la.',
      );
    }

    return this.prisma.knowledgeBase.delete({
      where: { id },
    });
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private mapKnowledgeBaseResponse(
    knowledgeBase: KnowledgeBaseRecord,
  ): KnowledgeBaseResponse {
    return {
      id: knowledgeBase.id,
      name: knowledgeBase.name,
      summary: knowledgeBase.summary,
      content: knowledgeBase.content,
      agentCount: knowledgeBase._count.agents,
      createdAt: knowledgeBase.createdAt,
      updatedAt: knowledgeBase.updatedAt,
    };
  }
}
