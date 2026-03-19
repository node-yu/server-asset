import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { GroupService } from './group.service';

@Controller('api/groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get()
  findAll() {
    return this.groupService.findAll();
  }

  @Post()
  create(@Body('name') name: string) {
    return this.groupService.create(name);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body('name') name: string) {
    return this.groupService.update(id, name);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.groupService.remove(id);
  }
}
