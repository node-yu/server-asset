-- AlterTable
ALTER TABLE `aws_accounts` ADD COLUMN `access_key_id` VARCHAR(255) NULL,
    ADD COLUMN `account_type` VARCHAR(50) NULL,
    ADD COLUMN `aws_account_id` VARCHAR(20) NULL,
    ADD COLUMN `login_account` VARCHAR(255) NULL,
    ADD COLUMN `login_method` VARCHAR(50) NULL,
    ADD COLUMN `mfa` VARCHAR(255) NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `password` TEXT NULL,
    ADD COLUMN `proxy` VARCHAR(255) NULL,
    ADD COLUMN `secret_access_key` TEXT NULL,
    ADD COLUMN `supplier` VARCHAR(100) NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
