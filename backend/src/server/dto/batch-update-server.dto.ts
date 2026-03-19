import { IsArray, IsNumber, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateServerDto } from './update-server.dto';

export class BatchUpdateServerDto extends UpdateServerDto {
  @IsArray()
  @ArrayMinSize(1, { message: '请至少选择一条记录' })
  @IsNumber({}, { each: true })
  @Type(() => Number)
  ids!: number[];
}
