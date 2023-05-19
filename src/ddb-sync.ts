#!/usr/bin/env ./node_modules/.bin/ts-node
import AWS from 'aws-sdk';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { getEnvironment, getUserInput, getDynamoDbDocumentClient, confirm } from './utils/scriptUtils';

const CHUNK_SIZE = 25;
const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  let index = 0;

  while (index < array.length) {
    chunks.push(array.slice(index, index + chunkSize));
    index += chunkSize;
  }

  return chunks;
};

(async () => {
  const tableName = await getUserInput('Table name:', 'planned-menu-data');
  const sourceEnvironment = await getEnvironment('Source environment:');
  const sourceProfile = await getUserInput('Source AWS profile:', 'gousto_local');
  const targetEnvironment = await getEnvironment('Target environment:');
  const targetProfile = await getUserInput('Target AWS profile:', 'gousto_local');
  const sourceTableName = `ddb-${sourceEnvironment}-${tableName}`;
  const targetTableName = `ddb-${targetEnvironment}-${tableName}`;

  const sourceDdb = getDynamoDbDocumentClient(sourceEnvironment, sourceProfile);
  const targetDdb = getDynamoDbDocumentClient(targetEnvironment, targetProfile);

  const syncDynamoDB = async () => {
    try {
      const sourceItems = await scanTable(sourceDdb, sourceTableName);
      const targetItems = await scanTable(targetDdb, targetTableName);

      const diffItems = findDifference(sourceItems, targetItems);

      console.log(diffItems);
      console.log(`Dry Run - ${diffItems.length} ttems to be written to the target table:`);

      if (await confirm('Copy above items?')) {
        await batchWriteItems(targetDdb, targetTableName, diffItems);

        console.log('Sync completed successfully!');
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error occurred during sync:', error);
    }
  };

  const scanTable = async (
    dynamoDB: DynamoDBDocument,
    tableName: string,
  ): Promise<AWS.DynamoDB.DocumentClient.ItemList> => {
    const items: AWS.DynamoDB.DocumentClient.ItemList = [];

    let exclusiveStartKey: AWS.DynamoDB.DocumentClient.Key | undefined = undefined;

    do {
      const params: AWS.DynamoDB.DocumentClient.ScanInput = {
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
      };

      const result = await dynamoDB.scan(params);

      items.push(...(result.Items || []));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items || [];
  };

  const findDifference = (
    sourceItems: AWS.DynamoDB.DocumentClient.ItemList,
    targetItems: AWS.DynamoDB.DocumentClient.ItemList,
  ): AWS.DynamoDB.DocumentClient.ItemList => {
    return sourceItems.filter((sourceItem) => !targetItems.find((targetItem) => targetItem.id === sourceItem.id));
  };

  const batchWriteItems = async (
    dynamoDB: DynamoDBDocument,
    tableName: string,
    items: AWS.DynamoDB.DocumentClient.ItemList,
  ): Promise<void> => {
    const chunks = chunkArray(items, CHUNK_SIZE);

    for (const chunk of chunks) {
      const params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput = {
        RequestItems: {
          [tableName]: chunk.map((item) => ({
            PutRequest: {
              Item: item,
            },
          })),
        },
      };

      await dynamoDB.batchWrite(params);
    }
  };

  try {
    await syncDynamoDB();
  } catch (err: any) {
    console.error(err);
  }
})();
