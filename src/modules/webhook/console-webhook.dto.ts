import { IsISO8601, IsNotEmpty, IsObject, IsString } from 'class-validator';

export class ConsoleWebhookDto {
  @IsString()
  @IsNotEmpty()
  event!: string;

  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsISO8601()
  timestamp!: string;

  @IsObject()
  data!: Record<string, unknown>;
}
