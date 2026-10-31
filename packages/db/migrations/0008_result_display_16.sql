-- Existing rooms were created with a 5–12 s result phase; the full-screen dice (hold + 3-2-1
-- countdown + board) need 16 s. Only raises, never lowers a host's choice.
UPDATE "jhandi"."rooms"
SET "config" = jsonb_set("config", '{resultDisplaySec}', '16'::jsonb, true)
WHERE "status" <> 'CLOSED'
  AND coalesce(("config"->>'resultDisplaySec')::int, 0) < 16;
