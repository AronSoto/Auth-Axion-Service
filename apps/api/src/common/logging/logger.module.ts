import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { AppConfigModule } from '@/config/app-config.module';
import { AppConfigService } from '@/config/app-config.service';

// Structured JSON logging with a per-request id. Nest's built-in Logger calls
// are routed through pino once main.ts calls app.useLogger(...).
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.isProduction
            ? 'info'
            : config.isTest
              ? 'silent'
              : 'debug',
          // Honor an inbound X-Request-Id or mint one; echo it back on the response.
          genReqId: (req: IncomingMessage, res: ServerResponse): string => {
            const header = req.headers['x-request-id'];
            const id =
              (Array.isArray(header) ? header[0] : header) ?? randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          // Never log credentials or session material.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.newPassword',
            ],
            remove: true,
          },
          // Pretty, single-line logs in dev; raw JSON in prod; quiet in tests.
          transport:
            config.isProduction || config.isTest
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
