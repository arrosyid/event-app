-- AlterTable
ALTER TABLE `ticket_types` MODIFY `quota` INTEGER NULL,
    MODIFY `sold` INTEGER NULL DEFAULT 0;
