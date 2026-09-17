-- AlterTable
ALTER TABLE "User" ADD COLUMN     "secondaryChapterId" TEXT;

-- CreateIndex
CREATE INDEX "User_secondaryChapterId_idx" ON "User"("secondaryChapterId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_secondaryChapterId_fkey" FOREIGN KEY ("secondaryChapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
