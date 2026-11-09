-- No daily loss limit: players may bet and win or lose any amount (0 = off).
INSERT INTO "jhandi"."platform_settings" ("key", "value") VALUES ('DAILY_LOSS_CAP', '0')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
