import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';

export class TimelineQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit? = 100;

  @IsOptional()
  @IsISO8601()
  before?: string;
}

export type TimelineEventSource = 'whatsapp' | 'activity' | 'agent';

export interface UnifiedTimelineEvent {
  source: TimelineEventSource;
  createdAt: Date;
  data: unknown;
}

export interface TimelineResponse {
  items: UnifiedTimelineEvent[];
  nextCursor: string | null;
}

export interface LatestAgentSuggestion {
  mark_qualified: true;
  qualification_reason: string | null;
  suggested_next_stage_id: string | null;
  suggested_next_stage_name: string | null;
  confirmedAt: string;
}
