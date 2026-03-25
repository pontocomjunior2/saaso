import { Module } from '@nestjs/common';
import { LeadFormService } from './lead-form.service';
import { LeadFormController } from './lead-form.controller';
import { PublicLeadFormController } from './public-lead-form.controller';
import { JourneyModule } from '../journey/journey.module';

@Module({
  imports: [JourneyModule],
  providers: [LeadFormService],
  controllers: [LeadFormController, PublicLeadFormController],
  exports: [LeadFormService],
})
export class LeadFormModule {}
