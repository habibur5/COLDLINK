// src/shared/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';

export class ErrorHandler {
  public static handle = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    // Known operational domain errors
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        statusCode: err.statusCode,
        errors: err.serializeErrors(),
      });
      return;
    }

    // Unexpected internal crashes or unhandled exceptions
    console.error('Unhandled System Exception:', err);

    res.status(500).json({
      success: false,
      statusCode: 500,
      errors: [{ message: 'An unexpected internal error occurred.' }],
    });
  };
}