import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LeadFormService } from './lead-form.service';

@Controller('public/forms')
export class PublicLeadFormController {
  constructor(private readonly leadFormService: LeadFormService) {}

  @Get(':tenantSlug/:slug')
  public async getForm(
    @Param('tenantSlug') tenantSlug: string,
    @Param('slug') slug: string,
  ) {
    return this.leadFormService.getPublicForm(tenantSlug, slug);
  }

  @Post(':tenantSlug/:slug/submit')
  public async submitForm(
    @Param('tenantSlug') tenantSlug: string,
    @Param('slug') slug: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.leadFormService.submitPublicForm(tenantSlug, slug, payload);
  }
}
