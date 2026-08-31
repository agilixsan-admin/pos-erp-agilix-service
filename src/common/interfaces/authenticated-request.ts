import { Request } from 'express';
import { User } from '../../modules/user/user.entity';

export type AuthenticatedRequest = Request & {
  user?: User;
};
