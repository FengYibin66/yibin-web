CREATE TABLE `profile` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`name_en` text DEFAULT 'Yibin Feng' NOT NULL,
	`name_zh` text DEFAULT '冯一镔' NOT NULL,
	`bio_en` text DEFAULT 'AI Engineer · Researcher · Builder' NOT NULL,
	`bio_zh` text DEFAULT 'AI 工程师 · 研究员 · 构建者' NOT NULL,
	`avatar_path` text DEFAULT '/uploads/avatar.jpg' NOT NULL,
	`github` text DEFAULT 'https://github.com/FengYibin66' NOT NULL,
	`linkedin` text DEFAULT 'https://linkedin.com/in/yibinfeng-imperial' NOT NULL,
	`email` text DEFAULT 'fengyibinapply@163.com' NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project` (
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
	`visible` integer DEFAULT 1 NOT NULL
);
