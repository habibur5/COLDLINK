// src/app.routes.ts
import { Router } from 'express';
import { EntityManager } from '@mikro-orm/mysql';
import { BaseRouter } from '#shared/routes/base.router.js';


export class AppRouter {
  public router: Router;
  private routers: BaseRouter[];

  constructor(em: EntityManager) {
    this.router = Router();

    // Register all domain routers here

    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.routers.forEach((route) => {
      this.router.use(route.path, route.router);
    });
  }
}