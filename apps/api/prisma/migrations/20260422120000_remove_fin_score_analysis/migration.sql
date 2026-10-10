-- Remove deprecated Fin Score analysis schema.
DROP TABLE IF EXISTS "ProjectionSnapshot" CASCADE;
DROP TABLE IF EXISTS "OnboardingRecommendation" CASCADE;
DROP TABLE IF EXISTS "OnboardingCategoryScore" CASCADE;
DROP TABLE IF EXISTS "OnboardingAnalysisRun" CASCADE;
DROP TABLE IF EXISTS "UserFinancialProfile" CASCADE;

DROP TYPE IF EXISTS "AnalysisRunStatus";
DROP TYPE IF EXISTS "ConfidenceLevel";
