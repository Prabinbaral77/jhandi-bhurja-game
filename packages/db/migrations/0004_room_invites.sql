CREATE TABLE "jhandi"."room_invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "room_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "jhandi"."room_invites" ADD CONSTRAINT "room_invites_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "jhandi"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jhandi"."room_invites" ADD CONSTRAINT "room_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "jhandi"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_invites_one_active" ON "jhandi"."room_invites" USING btree ("room_id") WHERE "jhandi"."room_invites"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "room_invites_code_active" ON "jhandi"."room_invites" USING btree ("code_hash") WHERE "jhandi"."room_invites"."revoked_at" IS NULL;