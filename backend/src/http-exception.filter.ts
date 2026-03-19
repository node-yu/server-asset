import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception && typeof exception === 'object' && 'getStatus' in exception
      ? (exception as { getStatus: () => number }).getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof Error ? exception.message : 'Internal Server Error';
    this.logger.error(`[${status}] ${message}`, exception instanceof Error ? exception.stack : '');

    // 生产环境隐藏详细错误
    const safeMessage = status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message;

    response.status(status).json({
      statusCode: status,
      message: safeMessage,
    });
  }
}
