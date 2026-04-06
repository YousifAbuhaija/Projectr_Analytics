-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "mailingAddress" TEXT,
    "ownerName" TEXT NOT NULL,
    "matchReason" TEXT NOT NULL,
    "parentEntity" TEXT NOT NULL DEFAULT 'OTHER',
    "subsidiaryChain" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceReason" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "fipsTract" TEXT,
    "zipCode" TEXT,
    "acquisitionYear" INTEGER,
    "purchasePrice" DOUBLE PRECISION,
    "city" TEXT NOT NULL DEFAULT 'Austin',
    "state" TEXT NOT NULL DEFAULT 'TX',
    "geocodedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TractMetrics" (
    "id" TEXT NOT NULL,
    "fipsTract" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "medianIncome" DOUBLE PRECISION,
    "pctRenter" DOUBLE PRECISION,
    "pctWhite" DOUBLE PRECISION,
    "pctBlack" DOUBLE PRECISION,
    "pctHispanic" DOUBLE PRECISION,
    "pctAsian" DOUBLE PRECISION,
    "homeownershipRate" DOUBLE PRECISION,
    "totalHousingUnits" INTEGER,
    "medianRent" DOUBLE PRECISION,
    "city" TEXT,
    "county" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TractMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceIndex" (
    "id" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "zhvi" DOUBLE PRECISION,
    "zori" DOUBLE PRECISION,
    "fmr" DOUBLE PRECISION,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvictionRate" (
    "id" TEXT NOT NULL,
    "fipsTract" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "evictionRate" DOUBLE PRECISION,
    "evictionFilingRate" DOUBLE PRECISION,
    "evictions" INTEGER,
    "evictionFilings" INTEGER,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvictionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcentrationScore" (
    "id" TEXT NOT NULL,
    "fipsTract" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "totalSfrUnits" INTEGER,
    "blackrockOwnedUnits" INTEGER NOT NULL DEFAULT 0,
    "concentrationPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConcentrationScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubsidiaryEntity" (
    "id" TEXT NOT NULL,
    "llcName" TEXT NOT NULL,
    "parentEntity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "registeredState" TEXT,
    "registeredAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubsidiaryEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineJob" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "city" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMsg" TEXT,
    "rowsProcessed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_fipsTract_idx" ON "Property"("fipsTract");
CREATE INDEX "Property_parentEntity_idx" ON "Property"("parentEntity");
CREATE INDEX "Property_zipCode_idx" ON "Property"("zipCode");
CREATE INDEX "Property_acquisitionYear_idx" ON "Property"("acquisitionYear");
CREATE INDEX "Property_city_idx" ON "Property"("city");
CREATE INDEX "Property_confidenceScore_idx" ON "Property"("confidenceScore");

CREATE UNIQUE INDEX "TractMetrics_fipsTract_year_key" ON "TractMetrics"("fipsTract", "year");
CREATE INDEX "TractMetrics_fipsTract_idx" ON "TractMetrics"("fipsTract");
CREATE INDEX "TractMetrics_city_idx" ON "TractMetrics"("city");

CREATE UNIQUE INDEX "PriceIndex_zipCode_year_month_key" ON "PriceIndex"("zipCode", "year", "month");
CREATE INDEX "PriceIndex_zipCode_idx" ON "PriceIndex"("zipCode");
CREATE INDEX "PriceIndex_city_idx" ON "PriceIndex"("city");

CREATE UNIQUE INDEX "EvictionRate_fipsTract_year_key" ON "EvictionRate"("fipsTract", "year");
CREATE INDEX "EvictionRate_fipsTract_idx" ON "EvictionRate"("fipsTract");

CREATE UNIQUE INDEX "ConcentrationScore_fipsTract_key" ON "ConcentrationScore"("fipsTract");
CREATE INDEX "ConcentrationScore_city_idx" ON "ConcentrationScore"("city");
CREATE INDEX "ConcentrationScore_concentrationPct_idx" ON "ConcentrationScore"("concentrationPct");

CREATE UNIQUE INDEX "SubsidiaryEntity_llcName_key" ON "SubsidiaryEntity"("llcName");
CREATE INDEX "SubsidiaryEntity_parentEntity_idx" ON "SubsidiaryEntity"("parentEntity");

CREATE INDEX "PipelineJob_stage_idx" ON "PipelineJob"("stage");
CREATE INDEX "PipelineJob_status_idx" ON "PipelineJob"("status");
