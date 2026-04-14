import { Test, TestingModule } from '@nestjs/testing';
import { StageController } from './stage.controller';
import { StageService } from './stage.service';
import { AgentService } from '../agent/agent.service';

describe('StageController', () => {
  let controller: StageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StageController],
      providers: [
        { provide: StageService, useValue: {} },
        { provide: AgentService, useValue: {} },
      ],
    }).compile();

    controller = module.get<StageController>(StageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
