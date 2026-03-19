import { IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';

export class UpdateServerDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsString()
  status?: string;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
