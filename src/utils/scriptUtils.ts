import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { AwsCredentialIdentity, Provider } from '@aws-sdk/types';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { fromIni, fromSSO } from '@aws-sdk/credential-providers';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import inquirer from 'inquirer';
import { S3 } from '@aws-sdk/client-s3';

const LOCALSTACK_DUMMY_ACCOUNT_ID = '000000000000';

export const confirm = async (message: string): Promise<boolean> => {
  const confirmation = await inquirer.prompt([
    {
      type: 'list',
      name: 'confirmation',
      message,
      choices: ['Yes', 'No'],
      default: 'No',
    },
  ]);
  return confirmation.confirmation === 'Yes';
};

export const getEnvironment = async (message = 'Environment'): Promise<string> => {
  const confirmation = await inquirer.prompt([
    {
      type: 'list',
      name: 'environment',
      message,
      choices: ['local', 'kimchi', 'staging', 'production'],
      default: 'local',
    },
  ]);
  return confirmation.environment;
};

export const getUserInput = async (message: string, defaultValue?: string): Promise<string> => {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'input',
      message,
      default: defaultValue,
    },
  ]);

  return answers.input;
};

export const getTableName = async (message = 'Enter dynamoDb table name') => getUserInput(message);

export const getCredentials = (environment: string, profile: string): AwsCredentialIdentity | Provider<AwsCredentialIdentity> => {
  const isLocal = environment === 'local';
  const isProduction = environment === 'production';

  return isLocal || isProduction ? fromIni({ profile }) : fromSSO({ profile });
};

export const getDynamoDbClient = (environment: string, profile: string): DynamoDB => {
  const isLocal = environment === 'local';

  return new DynamoDB({
    endpoint: isLocal ? 'http://localhost:4566' : undefined,
    credentials: getCredentials(environment, profile),
  });
};

export const getDynamoDbDocumentClient = (environment: string, profile: string): DynamoDBDocument => {
  const client = getDynamoDbClient(environment, profile);

  return DynamoDBDocument.from(client);
};

export const getS3Client = (environment: string, profile: string): S3 => {
  const isLocal = environment === 'local';

  return new S3({
    endpoint: isLocal ? 'http://localhost:4566' : undefined,
    credentials: getCredentials(environment, profile),
  });
};

export const getAccount = async (environment: string, profile: string): Promise<string> => {
  if (environment === 'local') {
    return LOCALSTACK_DUMMY_ACCOUNT_ID;
  }

  const stsClient = new STSClient({
    endpoint: environment === 'local' ? 'http://localhost:4566' : undefined,
    credentials: getCredentials(environment, profile),
  });

  const response = await stsClient.send(new GetCallerIdentityCommand({}));
  return response.Account!;
};
