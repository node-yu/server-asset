-- AlterTable
ALTER TABLE `domains` ADD COLUMN `project` VARCHAR(100) NULL,
    ADD COLUMN `usage` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `domain_usage_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `domain_id` INTEGER NOT NULL,
    `project` VARCHAR(100) NULL,
    `usage` VARCHAR(255) NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `domain_usage_history` ADD CONSTRAINT `domain_usage_history_domain_id_fkey` FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
