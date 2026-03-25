import { Module } from '@nestjs/common';
import { StageService } from './stage.service';
import { StageController } from './stage.controller';

@Module({
  providers: [StageService],
  controllers: [StageController],
})
export class StageModule {}
