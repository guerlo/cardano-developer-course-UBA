import { UTxO } from "@meshsdk/core";

export type Oracle = {
  id: string;
  policyId: string;
  assetName: string;
  firstUtxo: UTxO;
  oracleAddress: string;
  name: string;
  description?: string;
  latestValue: number;
  status: "active" | "paused" | "retired";
  lastUpdated: string;
  history: Array<{ t: number; v: TransactionInformation }>;
};

export type TransactionInformation = { value: number; transactionHash: string };
