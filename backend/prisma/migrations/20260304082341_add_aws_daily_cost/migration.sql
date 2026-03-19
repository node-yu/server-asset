-- CreateTable
CREATE TABLE `aws_daily_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `aws_daily_costs_account_id_date_key`(`account_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `aws_daily_costs` ADD CONSTRAINT `aws_daily_costs_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `aws_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
