import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { IdcService } from './idc.service';
import { CreateIdcDto } from './dto/create-idc.dto';
import { UpdateIdcDto } from './dto/update-idc.dto';
import { AddAdjustmentDto } from './dto/add-adjustment.dto';

@Controller('api/idc')
export class IdcController {
  constructor(private readonly idcService: IdcService) {}

  @Get()
  findAll() {
    return this.idcService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.idcService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateIdcDto) {
    return this.idcService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIdcDto) {
    return this.idcService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.idcService.remove(id);
  }

  @Get(':id/adjustments')
  getAdjustments(@Param('id', ParseIntPipe) id: number) {
    return this.idcService.getAdjustments(id);
  }

  @Post(':id/adjustments')
  addAdjustment(@Param('id', ParseIntPipe) id: number, @Body() dto: AddAdjustmentDto) {
    return this.idcService.addAdjustment(id, dto);
  }
}
