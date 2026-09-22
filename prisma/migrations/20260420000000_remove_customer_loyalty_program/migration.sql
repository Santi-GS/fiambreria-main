-- DropForeignKey
ALTER TABLE "CustomerLoyaltyLedger" DROP CONSTRAINT IF EXISTS "CustomerLoyaltyLedger_shopId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerLoyaltyLedger" DROP CONSTRAINT IF EXISTS "CustomerLoyaltyLedger_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerLoyaltyLedger" DROP CONSTRAINT IF EXISTS "CustomerLoyaltyLedger_saleId_fkey";

-- DropTable
DROP TABLE IF EXISTS "CustomerLoyaltyLedger";

-- DropEnum
DROP TYPE IF EXISTS "CustomerLoyaltyLedgerType";

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN IF EXISTS "loyaltyPointsEarned",
DROP COLUMN IF EXISTS "loyaltyPointsRedeemed",
DROP COLUMN IF EXISTS "loyaltyDiscountAmount";
