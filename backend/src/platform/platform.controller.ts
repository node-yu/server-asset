import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { PlatformService } from './platform.service';

@Controller('api/platforms')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  findAll() {
    return this.platformService.findAll();
  }

  @Post()
  create(@Body() dto: { name: string; isIdcSupplier?: boolean }) {
    return this.platformService.create(dto.name, dto.isIdcSupplier);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { name: string; isIdcSupplier?: boolean },
  ) {
    return this.platformService.update(id, dto.name, dto.isIdcSupplier);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.platformService.remove(id);
  }
}
