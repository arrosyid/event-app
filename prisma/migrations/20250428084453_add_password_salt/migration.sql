/*
  Warnings:

  - Added the required column `password_salt` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `users` ADD COLUMN `password_salt` VARCHAR(255) NOT NULL,
    MODIFY `password` VARCHAR(255) NOT NULL;
