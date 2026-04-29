import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(255),
});

export type CreateRoomDto = z.infer<typeof createRoomSchema>;
