import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAwsCostDto {
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
