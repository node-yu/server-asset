-- CreateTable
CREATE TABLE `groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `groups_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Insert default group for existing projects
INSERT INTO `groups` (`name`) VALUES ('默认组');

-- Add group_id column (nullable first)
ALTER TABLE `projects` ADD COLUMN `group_id` INTEGER NULL;

-- Assign existing projects to default group
UPDATE `projects` SET `group_id` = (SELECT `id` FROM `groups` WHERE `name` = '默认组' LIMIT 1);

-- Make group_id required
ALTER TABLE `projects` MODIFY COLUMN `group_id` INTEGER NOT NULL;

-- Add foreign key
ALTER TABLE `projects` ADD CONSTRAINT `projects_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old unique on name, add composite unique (groupId, name)
ALTER TABLE `projects` DROP INDEX `projects_name_key`;
ALTER TABLE `projects` ADD CONSTRAINT `projects_group_id_name_key` UNIQUE (`group_id`, `name`);
