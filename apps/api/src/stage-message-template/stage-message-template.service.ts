import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStageMessageTemplateDto } from './dto/create-stage-message-template.dto';
import { UpdateStageMessageTemplateDto } from './dto/update-stage-message-template.dto';
import { StageMessageTemplate } from '@prisma/client';

@Injectable()
export class StageMessageTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  public async findAllByStage(
    tenantId: string,
    stageId: string,
  ): Promise<StageMessageTemplate[]> {
    // Validate that the stage belongs to this tenant via pipeline relation
    const stage = await this.prisma.stage.findFirst({
      where: { id: stageId, pipeline: { tenantId } },
    });

    if (!stage) {
      throw new NotFoundException(
        `Erro no Backend: Etapa com ID '${stageId}' não encontrada neste tenant.`,
      );
    }

    return this.prisma.stageMessageTemplate.findMany({
      where: { stageId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async findOne(
    tenantId: string,
    id: string,
  ): Promise<StageMessageTemplate> {
    const template = await this.prisma.stageMessageTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw new NotFoundException(
        `Erro no Backend: Template com ID '${id}' não encontrado neste tenant.`,
      );
    }

    return template;
  }

  public async create(
    tenantId: string,
    dto: CreateStageMessageTemplateDto,
  ): Promise<StageMessageTemplate> {
    // Validate that the stage belongs to this tenant via pipeline relation
    const stage = await this.prisma.stage.findFirst({
      where: { id: dto.stageId, pipeline: { tenantId } },
    });

    if (!stage) {
      throw new NotFoundException(
        `Erro no Backend: Etapa com ID '${dto.stageId}' não encontrada neste tenant.`,
      );
    }

    return this.prisma.stageMessageTemplate.create({
      data: {
        stageId: dto.stageId,
        name: dto.name,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
        tenantId,
      },
    });
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdateStageMessageTemplateDto,
  ): Promise<StageMessageTemplate> {
    await this.findOne(tenantId, id);

    return this.prisma.stageMessageTemplate.update({
      where: { id },
      data: { ...dto },
    });
  }

  public async remove(
    tenantId: string,
    id: string,
  ): Promise<StageMessageTemplate> {
    await this.findOne(tenantId, id);

    return this.prisma.stageMessageTemplate.delete({
      where: { id },
    });
  }
}
