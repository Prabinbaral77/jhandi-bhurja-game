-- Sign-up bonus lowered from 5,500 to 5,000 coins (product decision, 2026-10-31).
UPDATE "jhandi"."platform_settings" SET "value" = '5000' WHERE "key" = 'SIGNUP_BONUS' AND "value" = '5500';
