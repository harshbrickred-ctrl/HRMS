import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express, type Request, type Response } from 'express';
import { AppModule } from './app.module';

let cachedServer: Express | null = null;

async function bootstrapServer(): Promise<Express> {
  if (cachedServer) return cachedServer;

  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn', 'log'] },
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? true,
    credentials: true,
  });
  await app.init();
  cachedServer = expressApp;
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer();
  return server(req, res);
}

if (!process.env.VERCEL) {
  bootstrapServer().then((server) => {
    const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
    server.listen(port);
  });
}
