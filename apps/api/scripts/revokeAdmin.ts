import { setAdminFlag } from './adminFlag'

// Removes admin access by phone number or Google e-mail:
//   pnpm --filter @jhandi/api admin:revoke +9779812345678
await setAdminFlag(process.argv[2], false)
