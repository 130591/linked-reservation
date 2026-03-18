import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable, throwError } from 'rxjs'
import { map, catchError } from 'rxjs/operators'

@Injectable()
export class ResultInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data.isErr === 'function') {
          if (data.isErr()) {
            throw data.error
          }
          return data.value
        }
        return data
      }),
      catchError((error) => {
        if (typeof error?.toHttpException === 'function') {
          throw error.toHttpException()
        }
        return throwError(() => error)
      }),
    )
  }
}