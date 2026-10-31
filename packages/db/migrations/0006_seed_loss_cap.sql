INSERT INTO "jhandi"."platform_settings" ("key", "value") VALUES ('DAILY_LOSS_CAP', '3000')
ON CONFLICT ("key") DO NOTHING;
