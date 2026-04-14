import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CardService } from './card.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { MoveCardDto } from './dto/move-card.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AgentMoveDto } from './dto/agent-move.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('cards')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() createCardDto: CreateCardDto,
  ) {
    return this.cardService.create(tenantId, createCardDto);
  }

  @Get()
  public async findAll(
    @CurrentTenant() tenantId: string,
    @Query('stageId') stageId?: string,
    @Query('search') search?: string,
  ) {
    return this.cardService.findAll(tenantId, { stageId, search });
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.cardService.findOne(tenantId, id);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateCardDto: UpdateCardDto,
  ) {
    return this.cardService.update(tenantId, id, updateCardDto);
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.cardService.remove(tenantId, id);
  }

  @Patch(':id/move')
  public async moveCard(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() moveCardDto: MoveCardDto,
  ) {
    await this.cardService.moveCard(tenantId, id, moveCardDto);
    return { success: true, message: 'Card movido com sucesso.' };
  }

  @Post(':id/agent-move')
  public async agentMove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AgentMoveDto,
  ) {
    await this.cardService.agentMove(tenantId, id, dto);
    return { ok: true };
  }

  @Post(':id/send-message')
  public async sendMessage(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.cardService.sendMessage(tenantId, id, user.id, dto);
  }
}
