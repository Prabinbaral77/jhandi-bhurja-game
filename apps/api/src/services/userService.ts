import type { User } from '@jhandi/db/schema/users'
import { AppError } from '@jhandi/protocol/appError'
import type { PublicUser } from '@jhandi/protocol/user'
import { findUserById, updateUser } from '#repositories/userRepository'

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
  isAdmin: user.isAdmin,
})

export const getMe = async (userId: string): Promise<PublicUser> => {
  const user = await findUserById(userId)
  if (!user) throw new AppError('NOT_FOUND', 'User not found')
  return toPublicUser(user)
}

export const updateMe = async (
  userId: string,
  changes: { displayName?: string | undefined },
): Promise<PublicUser> => {
  const user = await updateUser(userId, changes)
  if (!user) throw new AppError('NOT_FOUND', 'User not found')
  return toPublicUser(user)
}
