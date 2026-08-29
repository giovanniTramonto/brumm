-- Revert: activatedAt turned out to conflict with the already-backdatable
-- contractStart field for retroactively-entered members. contractStart alone
-- (via isContractStarted) is the correct lower bound.
ALTER TABLE "User" DROP COLUMN IF EXISTS "activatedAt";
