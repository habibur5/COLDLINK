// src/shared/types/express.d.ts

import { SuccessResponse } from './response.types.js';

declare global {
  namespace Express {
    interface Response {
      success<T>(
        data: T,
        message?: string,
        statusCode?: number
      ): Response<SuccessResponse<T>>;
    }
  }
}

export {};