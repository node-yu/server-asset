import { IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';

export class AddAdjustmentDto {
  @IsDateString()
  adjustmentDate: string;

  @IsNumber()
  serverCountDelta: number;

  @IsNumber()
  bandwidthDelta: number;

  @IsOptional()
  @IsString()
  note?: string;
}
