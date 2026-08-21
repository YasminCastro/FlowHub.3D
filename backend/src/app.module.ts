import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { UserService } from './user/user.service.js';
import { UserController } from './user/user.controller.js';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { APP_GUARD } from '@nestjs/core';
import { MailModule } from './mail/mail.module.js';
import { CategoryModule } from './category/category.module.js';
import { PrinterModule } from './printer/printer.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    MailModule,
    CategoryModule,
    PrinterModule,
  ],
  controllers: [AppController, UserController],
  providers: [
    AppService,
    PrismaService,
    UserService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
