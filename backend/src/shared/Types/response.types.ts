// src/shared/types/response.types.ts

export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}