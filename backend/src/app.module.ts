import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { UserService } from './user/user.service.js';
import { UserController } from './user/user.controller.js';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
  controllers: [AppController, UserController],
  providers: [AppService, PrismaService, UserService],
})
export class AppModule {}
