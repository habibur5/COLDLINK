// src/shared/middlewares/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

export function validateDto<T extends object>(dtoClass: ClassConstructor<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. Transform plain JSON body to an instance of the DTO class
    const dtoInstance = plainToInstance(dtoClass, req.body);

    // 2. Validate the instance
    const errors: ValidationError[] = await validate(dtoInstance, {
      whitelist: true,               // Strip any properties not defined in the DTO
      forbidNonWhitelisted: true,    // Throw error if unknown fields are present
    });

    if (errors.length > 0) {
      // 3. Format errors cleanly for API response
      const formattedErrors = errors.map((err) => ({
        field: err.property,
        errors: Object.values(err.constraints || {}),
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors,
      });
      return;
    }

    // 4. Attach sanitized, validated instance back to req.body
    req.body = dtoInstance;
    next();
  };
}