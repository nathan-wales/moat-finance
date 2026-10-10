-- Transaction: composite indexes for spending, budget, and sync queries
CREATE INDEX "Transaction_userId_type_date_idx" ON "Transaction"("userId", "type", "date");
CREATE INDEX "Transaction_userId_type_categoryId_date_idx" ON "Transaction"("userId", "type", "categoryId", "date");
CREATE INDEX "Transaction_userId_hidden_date_idx" ON "Transaction"("userId", "hidden", "date");
CREATE INDEX "Transaction_userId_removedAt_idx" ON "Transaction"("userId", "removedAt");

-- Category: cover the isHidden filter used on nearly every transaction query
CREATE INDEX "Category_userId_isHidden_idx" ON "Category"("userId", "isHidden");

-- TransactionHashtag: cover COUNT queries by hashtagId (hashtag list page)
CREATE INDEX "TransactionHashtag_hashtagId_idx" ON "TransactionHashtag"("hashtagId");

-- HouseholdInvite: replace bare ownerUserId index with composite covering status+expiresAt filters
DROP INDEX "HouseholdInvite_ownerUserId_idx";
CREATE INDEX "HouseholdInvite_ownerUserId_status_expiresAt_idx" ON "HouseholdInvite"("ownerUserId", "status", "expiresAt");
