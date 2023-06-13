Script to sync DDB tables from one AWS account to another.

## Setting up:

1. `npm install`
1. Run `npm run ddb:sync` to sync items diff between 2 DynamoDB tables or via an S3 export/import of the whole table `npm run ddb:sync:s3`

#### DDB Sync with Scan
1. Scan the source/target tables.
2. Retrieve all items in memory and return the items that are not in the target table.
3. Batch write the items.


#### DDB Sync with S3
1. Start a S3 export of a DynamoDB table from the source AWS account.
2. Await until it is completed and import the exported data into the DynamoDB table in the target AWS account.
