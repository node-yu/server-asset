-- AlterTable
ALTER TABLE `idc_region_costs` ALTER COLUMN `platform` DROP DEFAULT;

-- CreateTable
CREATE TABLE `aws_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `account` VARCHAR(255) NOT NULL,
    `project` VARCHAR(100) NOT NULL,
    `usage` VARCHAR(255) NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
