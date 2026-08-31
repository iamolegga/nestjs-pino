import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable()
export class LoggerErrorInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    return next.handle().pipe(
      catchError((error) => {
        return throwError(() => {
          const response = context.switchToHttp().getResponse();

          if (response) {
            const isFastifyResponse = response.raw !== undefined;

            if (isFastifyResponse) {
              response.raw.err = error;
            } else {
              response.err = error;
            }
          }

          return error;
        });
      }),
    );
  }
}
