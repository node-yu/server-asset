/*
  Warnings:

  - You are about to drop the `idc_monthly_costs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `idc_monthly_costs` DROP FOREIGN KEY `idc_monthly_costs_idc_registration_id_fkey`;

-- DropTable
DROP TABLE `idc_monthly_costs`;

-- CreateTable
CREATE TABLE `idc_region_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `region` VARCHAR(100) NOT NULL,
    `cost` DOUBLE NOT NULL DEFAULT 0,
    `project` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `idc_region_costs_year_month_region_key`(`year`, `month`, `region`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
