-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "agenda" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "chairs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resources" JSONB NOT NULL DEFAULT '[]';
