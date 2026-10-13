import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Response } from 'express';
import { UPLOADS_ROOT } from './journal/journal-photo-storage.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  app.use(cookieParser());
  // Fotos enviadas pelos usuários. Nomes aleatórios (UUID) e só extensões de
  // imagem; o nosniff impede o navegador de tratar o arquivo como outra coisa.
  app.useStaticAssets(UPLOADS_ROOT, {
    prefix: '/uploads/',
    index: false,
    setHeaders: (res: Response) =>
      res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('Flowhub 3D API')
    .setDescription('Documentação da API do backend do Flowhub 3D')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
