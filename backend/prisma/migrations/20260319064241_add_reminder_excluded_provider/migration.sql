-- CreateTable
CREATE TABLE `reminder_excluded_providers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reminder_excluded_providers_provider_key`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
