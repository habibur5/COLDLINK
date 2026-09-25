// src/shared/errors/http-errors.ts
import { AppError } from './app-error.js';

export class NotFoundError extends AppError {
  public readonly statusCode = 404;

  constructor(public message: string = 'Resource not found') {
    super(message);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}

export class BadRequestError extends AppError {
  public readonly statusCode = 400;

  constructor(public message: string = 'Bad request') {
    super(message);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}

export class ConflictError extends AppError {
  public readonly statusCode = 409;

  constructor(public message: string = 'Resource conflict') {
    super(message);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}

export class UnauthorizedError extends AppError {
  public readonly statusCode = 401;

  constructor(public message: string = 'Unauthorized') {
    super(message);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}