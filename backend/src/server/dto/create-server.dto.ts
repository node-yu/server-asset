import { IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';

export class CreateServerDto {
  @IsString()
  platform: string;

  @IsString()
  hostname: string;

  @IsString()
  ip: string;

  @IsString()
  password: string;

  @IsString()
  project: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  config?: string;

  @IsOptional()
  @IsNumber()
  platformAccountId?: number;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  bandwidthType?: string;

  @IsOptional()
  @IsString()
  serverType?: string;

  @IsOptional()
  @IsString()
  manager?: string;

  @IsOptional()
  @IsString()
  usage?: string;

  @IsOptional()
  @IsDateString()
  createdAt?: string;

  @IsOptional()
  @IsDateString()
  cancelAt?: string;

  @IsNumber()
  @Min(0)
  monthlyCost: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
