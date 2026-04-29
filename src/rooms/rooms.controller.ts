import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request, ParseIntPipe, UsePipes } from '@nestjs/common';
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
    return this.roomsService.createRoom(body.name, req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.findOne(id);
  }

  @Delete(':id')
  async deleteRoom(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.roomsService.deleteRoom(id, req.user.id);
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query('before') before?: string,
  ) {
    const cursor = before ? parseInt(before, 10) : undefined;
    return this.roomsService.getMessages(id, cursor);
  }

  @Post(':id/messages')
  @UsePipes(new ZodValidationPipe(createMessageDto.createMessageSchema))
  async createMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: createMessageDto.CreateMessageDto,
    @Request() req
  ) {
    return this.roomsService.createMessage(id, req.user.id, body.content);
  }
}
