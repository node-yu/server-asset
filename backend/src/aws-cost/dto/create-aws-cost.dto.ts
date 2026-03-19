import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAwsCostDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  month?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  accountId?: number;

  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsString()
  usage?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;
}
