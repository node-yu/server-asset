import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class UpdateIdcDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  serverCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bandwidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  configCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bandwidthCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
