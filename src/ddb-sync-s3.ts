import { ExportTableToPointInTimeCommand, ExportTableToPointInTimeCommandInput, ImportTableCommand, ImportTableCommandInput } from "@aws-sdk/client-dynamodb";
import { getAccount, getDynamoDbClient, getEnvironment, getUserInput } from "./utils/scriptUtils";

const AWS_REGION = "eu-west-1";
const now = Date.now().toString();
const exportS3Bucket = 'ddb-exports';
const exportS3Prefix = `ddb-export-${now}`;

(async () => {
    try {
        const tableName = await getUserInput('Table to sync:', 'table-name');

        const secondaryIndexes = (await getUserInput('Secondary indexes to add (seperate indexes with comma):', ''))?.split(',');

        const sourceEnvironment = await getEnvironment('Source environment:');
        const sourceProfile = await getUserInput('Source AWS profile:', 'prod');

        const targetEnvironment = await getEnvironment('Target environment:');
        const targetProfile = await getUserInput('Target AWS profile:', 'local');

        const sourceTableName = `ddb-${sourceEnvironment}-${tableName}`;
        const targetTableName = `ddb-${targetEnvironment}-${tableName}`;

        const sourceDynamoDBClient = getDynamoDbClient(AWS_REGION, sourceProfile);
        const targetDynamoDBClient = getDynamoDbClient(AWS_REGION, targetProfile);

        const awsAccountId = await getAccount(sourceEnvironment, sourceProfile);

        // Export the DynamoDB table to S3
        const exportTable = async () => {
            const exportParams: ExportTableToPointInTimeCommandInput = {
                TableArn: `arn:aws:dynamodb:${AWS_REGION}:${awsAccountId}:table/${sourceTableName}`,
                S3Bucket: exportS3Bucket,
                S3Prefix: exportS3Prefix,
                ExportFormat: "DYNAMODB_JSON",
            };
            const exportCommand = new ExportTableToPointInTimeCommand(exportParams);

            // TODO: handle wait time until export is successful by checking ExportDescription.ExportStatus is "COMPLETED"
            await sourceDynamoDBClient.send(exportCommand)
            console.log(`Table: ${sourceTableName} exported successfully ✅`);
        };

        // Generate secondary indexes to create during import
        const GlobalSecondaryIndexes = secondaryIndexes?.map((secondaryIndex) => ({
            IndexName: secondaryIndex,
            KeySchema: [
                { AttributeName: `${secondaryIndex}PK`, KeyType: "HASH" },
                { AttributeName: `${secondaryIndex}SK`, KeyType: "RANGE" }
            ],
            Projection: {
                ProjectionType: "ALL"
            },
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
            }
        }));

        const AttributeDefinitionsGlobalSecondaryIndexes = secondaryIndexes?.map((secondaryIndex) => ({ AttributeName: secondaryIndex, AttributeType: "S" }));

        // Import the DynamoDB table from S3
        const importTable = async () => {
            const importParams: ImportTableCommandInput = {
                S3BucketSource: {
                    S3Bucket: exportS3Bucket,
                    S3KeyPrefix: exportS3Prefix,
                },
                TableCreationParameters: {
                    TableName: targetTableName,
                    KeySchema: [
                        { AttributeName: "PK", KeyType: "HASH" },
                        { AttributeName: "SK", KeyType: "RANGE" }
                    ],
                    AttributeDefinitions: [
                        { AttributeName: "PK", AttributeType: "S" },
                        { AttributeName: "SK", AttributeType: "S" },
                        ...AttributeDefinitionsGlobalSecondaryIndexes
                    ],
                    GlobalSecondaryIndexes,
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 5,
                        WriteCapacityUnits: 5
                    }
                },
                InputFormat: "DYNAMODB_JSON",
            };
            const importCommand = new ImportTableCommand(importParams);

            await targetDynamoDBClient.send(importCommand)
            console.log(`Table: ${targetTableName} imported successfully ✅`);
        };

        exportTable()
            .then(importTable)
            .catch((error) => {
                console.error('Error ❌:', error);
            });
    } catch (err: unknown) {
        console.error(err);
    }
})
