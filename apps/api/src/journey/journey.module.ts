import { Module } from '@nestjs/common';
import { JourneyService } from './journey.service';
import { JourneyController } from './journey.controller';
import { JourneyQueueService } from './journey-queue.service';

@Module({
  providers: [JourneyService, JourneyQueueService],
  controllers: [JourneyController],
  exports: [JourneyService],
})
export class JourneyModule {}
