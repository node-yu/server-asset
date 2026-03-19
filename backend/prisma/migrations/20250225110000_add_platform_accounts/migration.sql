-- CreateTable
CREATE TABLE `platform_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `platform_id` INTEGER NOT NULL,
    `account_name` VARCHAR(255) NOT NULL,
    `password` TEXT NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `platform_accounts` ADD CONSTRAINT `platform_accounts_platform_id_fkey` FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
