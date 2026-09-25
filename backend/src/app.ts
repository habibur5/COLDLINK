// src/app.ts
import express, { Application } from 'express';
import { RequestContext } from '@mikro-orm/mariadb';
import { AppRouter } from './app.routes.js';
import { ErrorHandler } from '#middlewares/error.middleware.js';
import { NotFoundError } from '#errors/http-errors.js';
import { initORM } from '#database/db.js';
import { responseMiddleware } from '#middlewares/response.middleware.js';

export class App {
  public app: Application;
  public db: ReturnType<typeof initORM>;

  constructor() {
    this.app = express();
    this.db = initORM();
    this.setupMiddlewares();
    this.mountRoutes();
    this.setupErrorHandling();
    this.onClose();
  }

  private setupMiddlewares(): void {
    this.app.use(express.json());
    this.app.use(responseMiddleware);
    this.app.use((_req, _res, next) => {
      RequestContext.create(this.db.em, next);
    });
  }

  private mountRoutes(): void {
    const apiRouter = new AppRouter(this.db.em);
    // Mount all routes under /api/v1
    this.app.use('/api/v1', apiRouter.router);
  }

  private setupErrorHandling(): void {
    this.app.use((req) => {
      throw new NotFoundError(`Cannot find route: ${req.method} ${req.originalUrl}`);
    });
    this.app.use(ErrorHandler.handle);
  }

  private onClose(): void {
    process.on('SIGINT', async () => {
      console.log('Closing database connection...');
      await this.db.orm.close();
      process.exit(0);
    });
  }
}