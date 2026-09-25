import { EntityManager, EntityRepository, MikroORM, Options } from '@mikro-orm/mariadb';
import config from '../../mikro-orm.config.js';
import { User, UserSchema } from '#modules/user/user.entity.js';

export interface Services {
  orm: MikroORM;
  em: EntityManager;
  user: EntityRepository<User>;
}

let cache: Services;

export function initORM(options?: Partial<Options>): Services {
  if (cache) {
    return cache;
  }

  const orm = new MikroORM({
    ...config,
    ...options,
  });

  // save to cache before returning
  return cache = {
    orm,
    em: orm.em,
    user: orm.em.getRepository(UserSchema),
  };
}


export const orm = await MikroORM.init(config);