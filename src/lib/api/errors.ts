import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpStatus } from './http-status';

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors?: FieldError[];
}

const HTTP_STATUS_TEXTS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

export function createErrorResponse(
  status: number,
  message: string,
  path: string,
  fieldErrors?: FieldError[],
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
    status,
    error: HTTP_STATUS_TEXTS[status] ?? 'Error',
    message,
    path,
  };
  if (fieldErrors && fieldErrors.length > 0) {
    body.fieldErrors = fieldErrors;
  }
  return NextResponse.json(body, { status });
}

export function zodErrorToFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
