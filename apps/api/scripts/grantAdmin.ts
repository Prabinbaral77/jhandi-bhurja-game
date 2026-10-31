import { setAdminFlag } from './adminFlag'

// Makes a user an admin by phone number or Google e-mail. Server-side only, never over the API:
//   pnpm --filter @jhandi/api admin:grant +9779812345678
//   pnpm --filter @jhandi/api admin:grant someone@gmail.com
// With ADMIN_EMAILS set, Google sign-in re-syncs the flag from that list (docs/security.md).
await setAdminFlag(process.argv[2], true)
