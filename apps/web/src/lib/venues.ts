import { VENUES, type Venue } from '@jhandi/protocol/room'

export const isVenue = (value: string): value is Venue =>
  (VENUES as readonly string[]).includes(value)
