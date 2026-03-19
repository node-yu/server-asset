-- AlterTable
ALTER TABLE `aws_accounts` ADD COLUMN `cost_query_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `cost_query_sort_order` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `cost_query_status` VARCHAR(20) NULL;
