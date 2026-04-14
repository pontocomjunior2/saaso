import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStageDto } from './dto/reorder-stage.dto';
import { Stage } from '@prisma/client';

@Injectable()
export class StageService {
  constructor(private readonly prisma: PrismaService) {}

  public async create(tenantId: string, dto: CreateStageDto): Promise<Stage> {
    // Valida pipeline
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: dto.pipelineId, tenantId },
    });

    if (!pipeline) {
      throw new NotFoundException(
        `Erro no Backend: Pipeline com ID '${dto.pipelineId}' não encontrado.`,
      );
    }

    // Pega a última ordem para anexar ao fim
    const lastStage = await this.prisma.stage.findFirst({
      where: { pipelineId: dto.pipelineId },
      orderBy: { order: 'desc' },
    });

    const newOrder = lastStage ? lastStage.order + 1 : 1;

    return this.prisma.stage.create({
      data: {
        name: dto.name,
        pipelineId: dto.pipelineId,
        order: newOrder,
      },
    });
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdateStageDto,
  ): Promise<Stage> {
    const stage = await this.findOne(tenantId, id);

    return this.prisma.stage.update({
      where: { id: stage.id },
      data: { ...dto },
    });
  }

  public async remove(tenantId: string, id: string): Promise<Stage> {
    const stage = await this.findOne(tenantId, id);

    return this.prisma.stage.delete({
      where: { id: stage.id },
    });
  }

  public async reorder(
    tenantId: string,
    pipelineId: string,
    dto: ReorderStageDto,
  ): Promise<void> {
    // Garante que o pipeline é do tenant
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId },
      include: { stages: true },
    });

    if (!pipeline) {
      throw new NotFoundException(
        `Erro no Backend: Pipeline com ID '${pipelineId}' não encontrado.`,
      );
    }

    // Verifica se todos os IDs passados pertencem a este pipeline
    const existingStageIds = pipeline.stages.map((s) => s.id);
    const isValid = dto.stageIds.every((id) => existingStageIds.includes(id));

    if (!isValid || dto.stageIds.length !== existingStageIds.length) {
      throw new BadRequestException(
        'Erro no Backend: A lista de IDs de etapas é inválida ou incompleta.',
      );
    }

    // Atualiza em transação
    await this.prisma.$transaction(
      dto.stageIds.map((stageId, index) =>
        this.prisma.stage.update({
          where: { id: stageId },
          data: { order: index + 1 },
        }),
      ),
    );
  }

  private async findOne(tenantId: string, id: string): Promise<Stage> {
    const stage = await this.prisma.stage.findFirst({
      where: {
        id,
        pipeline: { tenantId }, // Check relation via pipeline tenantId
      },
    });

    if (!stage) {
      throw new NotFoundException(
        `Erro no Backend: Etapa com ID '${id}' não encontrada neste tenant.`,
      );
    }

    return stage;
  }
}
