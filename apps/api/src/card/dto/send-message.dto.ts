import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { CampaignChannel } from '@prisma/client';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsEnum(CampaignChannel)
  channel: CampaignChannel;
}
