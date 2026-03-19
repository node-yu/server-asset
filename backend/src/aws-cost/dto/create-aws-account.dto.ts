import { IsString, IsOptional } from 'class-validator';

export class CreateAwsAccountDto {
  @IsString()
  name!: string;

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
}
