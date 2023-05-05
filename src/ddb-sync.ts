import { DynamoDBClient, ExportTableToPointInTimeCommand, ExportTableToPointInTimeCommandInput, ImportTableCommand, ImportTableCommandInput } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { S3Client } from "@aws-sdk/client-s3";

// Define the AWS credentials and region for the source account
const sourceCredentials = fromIni({
  profile: "source-account-profile"
});
const sourceRegion = "us-east-1";

// Define the AWS credentials and region for the destination account
const destCredentials = fromIni({
  profile: "dest-account-profile"
});
const destRegion = "eu-west-1";

// Define the name of the DynamoDB table to export and import
const tableName = "my-table";

// Define the name of the S3 bucket to use for the export and import
const bucketName = "my-export-bucket";

// Define the name of the S3 object for the export
const exportObjectName = "my-table-export";

// Define the name of the S3 object for the import
const importObjectName = "my-table-import";

// Define the timestamp for the point-in-time export
const exportTimestamp = Math.floor(Date.now() / 1000) - 3600; // One hour ago

// Define the DynamoDB and S3 clients for the source account
const sourceDynamoDBClient = new DynamoDBClient({ region: sourceRegion, credentials: sourceCredentials });
const sourceS3Client = new S3Client({ region: sourceRegion, credentials: sourceCredentials });

// Define the DynamoDB and S3 clients for the destination account
const destDynamoDBClient = new DynamoDBClient({ region: destRegion, credentials: destCredentials });
const destS3Client = new S3Client({ region: destRegion, credentials: destCredentials });

// Export the DynamoDB table to S3
const exportParams: ExportTableToPointInTimeCommandInput = {
  TableArn: `arn:aws:dynamodb:${sourceRegion}:${sourceCredentials.defaultProvider().accountId}:table/${tableName}`,
  S3Bucket: bucketName,
  S3Prefix: exportObjectName,
  ExportFormat: "DYNAMODB_JSON",
  ExportTime: exportTimestamp,
  S3SseAlgorithm: "AES256"
};
const exportCommand = new ExportTableToPointInTimeCommand(exportParams);
const exportTable = async () => {
    await sourceDynamoDBClient.send(exportCommand)
    console.log(`Table: ${tableName} exported successfully!`);
};

// Import the DynamoDB table from S3
const importParams: ImportTableCommandInput = {
  Source: {
    S3Bucket: bucketName,
    S3Prefix: importObjectName,
    S3SseAlgorithm: "AES256"
  },
  TargetTableName: tableName,
  ImportFormat: "DYNAMODB_JSON",
  TableCreationParameters: {
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" }
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  }
};
const importCommand = new ImportTableCommand(importParams);
const importTable = async () => {
    await destDynamoDBClient.send(importCommand)
    console.log(`Table: ${tableName} imported successfully!`);
};


exportTable()
  .then(importTable)
  .catch((error) => {
    console.error('Error:', error);
  });
