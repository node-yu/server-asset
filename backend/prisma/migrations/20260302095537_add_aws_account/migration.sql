/*
  Warnings:

  - You are about to drop the column `account` on the `aws_costs` table. All the data in the column will be lost.
  - Added the required column `account_id` to the `aws_costs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `aws_costs` DROP COLUMN `account`,
    ADD COLUMN `account_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `aws_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `aws_accounts_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `aws_costs` ADD CONSTRAINT `aws_costs_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `aws_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
