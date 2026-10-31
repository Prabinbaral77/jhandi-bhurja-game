-- System ledger accounts (docs/architecture.md §5.4). Fixed ids so code and reports can rely on them.
INSERT INTO "jhandi"."accounts" ("id", "type", "owner_id", "code", "balance") VALUES
  ('00000000-0000-7000-8000-000000000001', 'SYSTEM', NULL, 'BONUS', 0),
  ('00000000-0000-7000-8000-000000000002', 'SYSTEM', NULL, 'PLATFORM_FEE', 0),
  ('00000000-0000-7000-8000-000000000003', 'SYSTEM', NULL, 'ADJUSTMENT', 0)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Platform settings (docs/architecture.md §2.6). Admin-editable later without a deploy.
INSERT INTO "jhandi"."platform_settings" ("key", "value") VALUES
  ('SIGNUP_BONUS', '5000'),
  ('DAILY_BONUS', '10'),
  ('MIN_HOST_DEPOSIT', '5000'),
  ('MIN_HOST_BANK_TO_CONTINUE', '1000'),
  ('PLATFORM_FEE_BPS', '200'),
  ('PRIVATE_ROOM_MAX_MEMBERS', '20')
ON CONFLICT ("key") DO NOTHING;
