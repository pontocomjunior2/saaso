import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { UpdateConversationStatusDto } from './dto/update-conversation-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AgentRunnerService } from './agent-runner.service';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('preview-prompt')
  public async previewPrompt(
    @CurrentTenant() tenantId: string,
    @Body() updateAgentDto: UpdateAgentDto,
  ) {
    return this.agentService.previewPrompt(tenantId, updateAgentDto);
  }

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() createAgentDto: CreateAgentDto,
  ) {
    return this.agentService.create(tenantId, createAgentDto);
  }

  @Get()
  public async findAll(@CurrentTenant() tenantId: string) {
    return this.agentService.findAll(tenantId);
  }

  @Get('overview')
  public async getOverview(@CurrentTenant() tenantId: string) {
    return this.agentService.getOperationalOverview(tenantId);
  }

  @Get(':id/conversations')
  public async listConversations(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.agentService.listConversations(tenantId, id);
  }

  @Patch('conversations/:conversationId/status')
  public async updateConversationStatus(
    @CurrentTenant() tenantId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateConversationStatusDto,
  ) {
    return this.agentService.updateConversationStatus(
      tenantId,
      conversationId,
      dto.status,
    );
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.agentService.findOne(tenantId, id);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto,
  ) {
    return this.agentService.update(tenantId, id, updateAgentDto);
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.agentService.remove(tenantId, id);
  }
}

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('agent-conversations')
export class AgentConversationController {
  constructor(private readonly agentRunnerService: AgentRunnerService) {}

  @Post(':id/toggle-takeover')
  public async toggleTakeover(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.agentRunnerService.toggleTakeover(id, tenantId);
  }
}
