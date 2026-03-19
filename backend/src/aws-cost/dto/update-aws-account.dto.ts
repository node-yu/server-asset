import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAwsAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  awsAccountId?: string;

  @IsOptional()
  @IsString()
  loginAccount?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  loginMethod?: string;

  @IsOptional()
  @IsString()
  accountType?: string;

  @IsOptional()
  @IsString()
  accessKeyId?: string;

  @IsOptional()
  @IsString()
  secretAccessKey?: string;

  @IsOptional()
  @IsString()
  proxy?: string;

  @IsOptional()
  @IsString()
  mfa?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  costQueryStatus?: string; // full | cost_only

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  costQueryEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  costQuerySortOrder?: number;
}
