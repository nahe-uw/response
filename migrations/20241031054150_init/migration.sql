-- CreateEnum
CREATE TYPE "KnowledgeType" AS ENUM ('url', 'pdf');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryHistories" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "inquiryContent" TEXT NOT NULL,
    "inquiryElements" TEXT NOT NULL,
    "replyContent" TEXT,
    "dataSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryHistories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIConnections" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "apiURL" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APIConnections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tables" (
    "id" SERIAL NOT NULL,
    "tableName" TEXT NOT NULL,
    "tableDescription" TEXT,
    "apiConnectionId" INTEGER NOT NULL,

    CONSTRAINT "Tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Columns" (
    "id" SERIAL NOT NULL,
    "tableId" INTEGER NOT NULL,
    "columnName" TEXT NOT NULL,
    "columnDescription" TEXT,
    "isUserId" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValueMappings" (
    "id" SERIAL NOT NULL,
    "columnId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValueMappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableRelations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fromTable" TEXT NOT NULL,
    "fromColumn" TEXT NOT NULL,
    "toTable" TEXT NOT NULL,
    "toColumn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableRelations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCategories" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "categoryName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataCategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryTableMappings" (
    "id" SERIAL NOT NULL,
    "DataCategoryId" INTEGER NOT NULL,
    "tableName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryTableMappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Knowledge" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "knowledgeName" TEXT NOT NULL,
    "type" "KnowledgeType" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingData" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingModels" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "modelName" TEXT NOT NULL,
    "endpointUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingModels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAccounts" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "serviceAccountKey" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAccounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionHistories" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "inquiryContent" TEXT NOT NULL,
    "revisionContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionHistories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Tables" ADD CONSTRAINT "Tables_apiConnectionId_fkey" FOREIGN KEY ("apiConnectionId") REFERENCES "APIConnections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Columns" ADD CONSTRAINT "Columns_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValueMappings" ADD CONSTRAINT "ValueMappings_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryTableMappings" ADD CONSTRAINT "CategoryTableMappings_DataCategoryId_fkey" FOREIGN KEY ("DataCategoryId") REFERENCES "DataCategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
