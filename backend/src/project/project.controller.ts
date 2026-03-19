import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ProjectService } from './project.service';

@Controller('api/projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  findAll() {
    return this.projectService.findAll();
  }

  @Post()
  create(
    @Body('groupId') groupId: number,
    @Body('name') name: string,
    @Body('color') color?: string,
  ) {
    return this.projectService.create(groupId, name, color);
  }

  @Put(':id/move')
  move(@Param('id', ParseIntPipe) id: number, @Body('groupId') groupId: number) {
    return this.projectService.move(id, groupId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body('name') name: string,
    @Body('color') color?: string,
  ) {
    return this.projectService.update(id, name, color);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.remove(id);
  }
}
