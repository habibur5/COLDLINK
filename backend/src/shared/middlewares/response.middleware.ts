// src/middlewares/response.middleware.ts

import { Request, Response, NextFunction } from 'express';

export function responseMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  res.success = function <T>(
    data: T,
    message = 'Success',
    statusCode = 200
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  };

  next();
}