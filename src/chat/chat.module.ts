import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { SessionModule } from '../session/session.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [SessionModule, RoomsModule],
  providers: [ChatGateway],
})
export class ChatModule {}
