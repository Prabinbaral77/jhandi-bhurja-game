-- A client that dies mid-transaction (crash, killed request) must not keep row locks forever:
-- one stuck sign-up would block every other sign-up on the SYSTEM:BONUS account row.
-- Applied to the application role, so every connection (also through the pooler) inherits it.
ALTER ROLE CURRENT_USER SET idle_in_transaction_session_timeout = '30s';
--> statement-breakpoint
ALTER ROLE CURRENT_USER SET statement_timeout = '30s';
--> statement-breakpoint
ALTER ROLE CURRENT_USER SET lock_timeout = '10s';
