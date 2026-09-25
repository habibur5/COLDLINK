// src/shared/routes/base.router.ts
import { Router } from 'express';

export abstract class BaseRouter {
  public router: Router;
  public abstract readonly path: string;

  constructor() {
    this.router = Router();
  }

  // Must be called by child classes after setting up dependencies
  protected abstract initRoutes(): void;
}