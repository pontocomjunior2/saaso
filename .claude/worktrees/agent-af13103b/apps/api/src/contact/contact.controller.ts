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
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() createContactDto: CreateContactDto,
  ) {
    return this.contactService.create(tenantId, createContactDto);
  }

  @Post('manual-entry')
  public async createManualEntry(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateManualEntryDto,
  ) {
    return this.contactService.createManualEntry(tenantId, dto);
  }

  @Get()
  public async findAll(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
  ) {
    return this.contactService.findAll(tenantId, search);
  }

  @Get('segments')
  public async findSegments(@CurrentTenant() tenantId: string) {
    return this.contactService.findSegments(tenantId);
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.contactService.findOne(tenantId, id);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
  ) {
    return this.contactService.update(tenantId, id, updateContactDto);
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.contactService.remove(tenantId, id);
  }
}
