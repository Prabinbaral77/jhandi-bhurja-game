CREATE TYPE "jhandi"."bonus_kind" AS ENUM('SIGNUP', 'DAILY');--> statement-breakpoint
CREATE TYPE "jhandi"."account_type" AS ENUM('USER', 'ROOM_BANK', 'ROUND_ESCROW', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "jhandi"."transaction_kind" AS ENUM('SIGNUP_BONUS', 'DAILY_BONUS', 'HOST_DEPOSIT', 'BANK_TOPUP', 'BET', 'BET_CANCEL', 'SETTLE', 'PLATFORM_FEE', 'ROOM_CLOSE', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "jhandi"."auth_provider" AS ENUM('PHONE', 'GOOGLE');--> statement-breakpoint
CREATE TYPE "jhandi"."user_status" AS ENUM('ACTIVE', 'FROZEN', 'BANNED');--> statement-breakpoint
CREATE TABLE "jhandi"."bonuses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "jhandi"."bonus_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"bonus_date" date NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jhandi"."accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "jhandi"."account_type" NOT NULL,
	"owner_id" uuid,
	"code" text,
	"balance" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_code_unique" UNIQUE("code"),
	CONSTRAINT "accounts_type_owner_id_unique" UNIQUE("type","owner_id"),
	CONSTRAINT "accounts_balance_non_negative" CHECK ("jhandi"."accounts"."type" = 'SYSTEM' OR "jhandi"."accounts"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "jhandi"."ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jhandi"."transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" "jhandi"."transaction_kind" NOT NULL,
	"idempotency_key" text NOT NULL,
	"ref_type" text,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "jhandi"."auth_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "jhandi"."auth_provider" NOT NULL,
	"subject" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_provider_subject_unique" UNIQUE("provider","subject")
);
--> statement-breakpoint
CREATE TABLE "jhandi"."otp_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jhandi"."refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "jhandi"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"status" "jhandi"."user_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jhandi"."bonuses" ADD CONSTRAINT "bonuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "jhandi"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "jhandi"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "jhandi"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "jhandi"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "jhandi"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bonuses_signup_once" ON "jhandi"."bonuses" USING btree ("user_id") WHERE "jhandi"."bonuses"."kind" = 'SIGNUP';--> statement-breakpoint
CREATE UNIQUE INDEX "bonuses_daily_once" ON "jhandi"."bonuses" USING btree ("user_id","bonus_date") WHERE "jhandi"."bonuses"."kind" = 'DAILY';--> statement-breakpoint
CREATE INDEX "ledger_entries_account_id_created_at_index" ON "jhandi"."ledger_entries" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_id_index" ON "jhandi"."ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transactions_ref_type_ref_id_index" ON "jhandi"."transactions" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "auth_identities_user_id_index" ON "jhandi"."auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "otp_codes_phone_created_at_index" ON "jhandi"."otp_codes" USING btree ("phone","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_index" ON "jhandi"."refresh_tokens" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "jhandi"."platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "jhandi"."users"("id") ON DELETE no action ON UPDATE no action;