import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CreateIdcDto {
  @IsNumber()
  platformAccountId: number;

  @IsString()
  region: string;

  @IsString()
  config: string;

  @IsNumber()
  @Min(0)
  serverCount: number;

  @IsNumber()
  @Min(0)
  bandwidth: number;

  @IsNumber()
  @Min(0)
  configCost: number;

  @IsNumber()
  @Min(0)
  bandwidthCost: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
