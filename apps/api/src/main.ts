import { setDefaultResultOrder } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express, type Request, type Response } from 'express';
import { AppModule } from './app.module';

setDefaultResultOrder('ipv4first');

function allowedOrigin(origin?: string) {
  if (!origin) return true;
  const configured = process.env.WEB_ORIGIN?.trim();
  if (!configured || configured === 'true' || configured === '*' || origin === configured) {
    return true;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'peopleos.vercel.app') return true;
    if (host.endsWith('.vercel.app') && host.includes('peopleos') && !host.includes('peopleos-api')) {
      return true;
    }
  } catch {
    /* ignore invalid Origin */
  }
  return false;
}

let cachedServer: Express | null = null;

async function bootstrapServer(): Promise<Express> {
  if (cachedServer) return cachedServer;

  const expressApp = express();
  expressApp.use('/api/v1/iclock', express.text({ type: () => true, limit: '5mb' }));
  expressApp.use('/api/v1/salary/payout/direct/webhook', express.raw({ type: () => true, limit: '1mb' }));
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn', 'log'] },
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Webpack can desync class-validator metadata; strip unknowns instead of 400.
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, allowedOrigin(origin));
    },
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
