export interface IntegrationOperationRecord {
  integrationId: string;
  operationKey: string;
  action: string;
  requestJson: string;
  resultJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationCursorRecord {
  integrationId: string;
  consumerKey: string;
  lastEventId: string;
  createdAt: string;
  updatedAt: string;
}
