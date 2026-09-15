import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

function serializeBigInt(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }
  return obj;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<unknown>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(
      map((res) => {
        const serialized = serializeBigInt(res);

        if (
          serialized &&
          typeof serialized === 'object' &&
          'success' in serialized
        ) {
          return serialized as ApiResponse<unknown>;
        }

        let message = 'Success';
        let data: unknown = serialized;

        if (
          serialized &&
          typeof serialized === 'object' &&
          !Array.isArray(serialized)
        ) {
          const record = serialized as Record<string, unknown>;
          if (typeof record.message === 'string') {
            message = record.message;
            const { message: _msg, ...rest } = record;
            data = Object.keys(rest).length > 0 ? rest : null;
          }
        }

        return {
          success: true,
          message,
          data,
        };
      }),
    );
  }
}
