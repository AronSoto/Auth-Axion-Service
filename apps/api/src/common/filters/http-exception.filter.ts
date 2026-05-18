import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let error: string | undefined;

    let stack: string | undefined;

    if (exception instanceof HttpException) {
      const r = exception.getResponse();
      if (typeof r === 'string') {
        message = r;
      } else if (typeof r === 'object' && r !== null) {
        const body = r as { message?: string | string[]; error?: string };
        message = body.message ?? exception.message;
        error = body.error;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      stack = exception.stack;
    } else {
      message = `Unknown exception: ${String(exception)}`;
    }

    this.logFailure(status, request, message, stack);

    const body: ErrorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(error ? { error } : {}),
    };

    response.status(status).json(body);
  }

  private logFailure(
    status: number,
    request: Request,
    message: string | string[],
    stack?: string,
  ): void {
    const level =
      status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN
        ? 'warn'
        : status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'error'
          : null;
    if (!level) return;

    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const text = Array.isArray(message) ? message.join('; ') : message;
    const line = `${status} ${request.method} ${request.url} from ${ip} — ${text}`;
    if (level === 'error' && stack) {
      this.logger.error(line, stack);
    } else {
      this.logger[level](line);
    }
  }
}
