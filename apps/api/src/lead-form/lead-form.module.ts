import { Module } from '@nestjs/common';
import { LeadFormService } from './lead-form.service';
import { LeadFormController } from './lead-form.controller';
import { PublicLeadFormController } from './public-lead-form.controller';
import { RateLimitService } from './rate-limit.service';
import { JourneyModule } from '../journey/journey.module';

@Module({
  imports: [JourneyModule],
  providers: [LeadFormService, RateLimitService],
  controllers: [LeadFormController, PublicLeadFormController],
  exports: [LeadFormService],
})
export class LeadFormModule {}
