import { UserEntity } from '../../entities/user.entity'

export type AuthenticatedUser = Omit<
  UserEntity,
  'passwordHash' | 'refreshToken' | 'workspaces'
> & {
  currentWebSessionId?: string
  currentMobileSessionId?: string
}
