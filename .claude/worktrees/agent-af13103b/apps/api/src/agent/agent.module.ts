import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { AgentRunnerService } from './agent-runner.service';

@Module({
  providers: [AgentService, AgentRunnerService],
  controllers: [AgentController],
  exports: [AgentService, AgentRunnerService],
})
export class AgentModule {}
