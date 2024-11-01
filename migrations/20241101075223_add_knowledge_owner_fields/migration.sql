-- AlterTable
ALTER TABLE "Knowledge" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "isOwner" BOOLEAN NOT NULL DEFAULT false;
