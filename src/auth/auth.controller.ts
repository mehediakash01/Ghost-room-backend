import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as loginDto from './dto/login.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('login')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(loginDto.loginSchema))
  async login(@Body() body: loginDto.LoginDto) {
    return this.authService.login(body.username);
  }
}
