CREATE TYPE "jhandi"."bet_status" AS ENUM('PLACED', 'CANCELLED', 'WON', 'LOST', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "jhandi"."member_role" AS ENUM('HOST', 'PLAYER', 'SPECTATOR');--> statement-breakpoint
CREATE TYPE "jhandi"."room_status" AS ENUM('OPEN', 'PAUSED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "jhandi"."room_visibility" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "jhandi"."round_status" AS ENUM('BETTING', 'LOCKED', 'SETTLED', 'VOIDED');--> statement-breakpoint
CREATE TABLE "jhandi"."bets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" "jhandi"."bet_status" DEFAULT 'PLACED' NOT NULL,
	"payout" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bets_round_id_user_id_symbol_unique" UNIQUE("round_id","user_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "jhandi"."room_members" (
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "jhandi"."member_role" NOT NULL,
	"access" text DEFAULT 'PUBLIC' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	CONSTRAINT "room_members_room_id_user_id_pk" PRIMARY KEY("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "jhandi"."rooms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"host_id" uuid NOT NULL,
	"name" text NOT NULL,
	"visibility" "jhandi"."room_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"venue" text NOT NULL,
	"config" jsonb NOT NULL,
	"status" "jhandi"."room_status" DEFAULT 'OPEN' NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"max_members" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jhandi"."rounds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"round_no" integer NOT NULL,
	"status" "jhandi"."round_status" DEFAULT 'BETTING' NOT NULL,
	"seed_hash" text NOT NULL,
	"server_seed" text,
	"dice" smallint[],
	"losing_stakes" bigint,
	"winnings_paid" bigint,
	"platform_fee" bigint,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	CONSTRAINT "rounds_room_id_round_no_unique" UNIQUE("room_id","round_no")
);
--> statement-breakpoint
ALTER TABLE "jhandi"."bets" ADD CONSTRAINT "bets_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "jhandi"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."bets" ADD CONSTRAINT "bets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "jhandi"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "jhandi"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."room_members" ADD CONSTRAINT "room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "jhandi"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."rooms" ADD CONSTRAINT "rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "jhandi"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."rounds" ADD CONSTRAINT "rounds_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "jhandi"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bets_user_id_created_at_index" ON "jhandi"."bets" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "rooms_status_visibility_index" ON "jhandi"."rooms" USING btree ("status","visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_one_active_per_host" ON "jhandi"."rooms" USING btree ("host_id") WHERE "jhandi"."rooms"."status" <> 'CLOSED';--> statement-breakpoint
CREATE INDEX "rounds_status_index" ON "jhandi"."rounds" USING btree ("status");