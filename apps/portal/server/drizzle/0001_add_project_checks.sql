PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_en` text NOT NULL,
	`name_zh` text NOT NULL,
	`desc_en` text NOT NULL,
	`desc_zh` text NOT NULL,
	`tech_tags` text DEFAULT '[]' NOT NULL,
	`screenshot_path` text,
	`url` text NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "project_status_valid" CHECK("__new_project"."status" IN ('live', 'dev')),
	CONSTRAINT "project_visible_bool" CHECK("__new_project"."visible" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_project`("id", "name_en", "name_zh", "desc_en", "desc_zh", "tech_tags", "screenshot_path", "url", "status", "order", "visible") SELECT "id", "name_en", "name_zh", "desc_en", "desc_zh", "tech_tags", "screenshot_path", "url", "status", "order", "visible" FROM `project`;--> statement-breakpoint
DROP TABLE `project`;--> statement-breakpoint
ALTER TABLE `__new_project` RENAME TO `project`;--> statement-breakpoint
PRAGMA foreign_keys=ON;