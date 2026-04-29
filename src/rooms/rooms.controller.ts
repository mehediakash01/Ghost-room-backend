import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request, UsePipes } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import * as createRoomDto from './dto/create-room.dto';
import * as createMessageDto from './dto/create-message.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('rooms')
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll() {
    return this.roomsService.findAll();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createRoomDto.createRoomSchema))
  async createRoom(@Body() body: createRoomDto.CreateRoomDto, @Request() req) {
    return this.roomsService.createRoom(body.name, req.user.username);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Delete(':id')
  async deleteRoom(@Param('id') id: string, @Request() req) {
    return this.roomsService.deleteRoom(id, req.user.username);
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('before') before?: string,
  ) {
    return this.roomsService.getMessages(id, before);
  }

  @Post(':id/messages')
  @UsePipes(new ZodValidationPipe(createMessageDto.createMessageSchema))
  async createMessage(
    @Param('id') id: string,
    @Body() body: createMessageDto.CreateMessageDto,
    @Request() req
  ) {
    return this.roomsService.createMessage(id, req.user.username, body.content);
  }
}
