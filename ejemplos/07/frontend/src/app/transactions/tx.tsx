"use client";
import {
  applyCborEncoding,
  applyParamsToScript,
  BlockfrostProvider,
  deserializeAddress,
  integer,
  IWallet,
  mConStr0,
  mConStr1,
  MeshTxBuilder,
  PlutusScript,
  resolveScriptHash,
  serializePlutusScript,
  stringToHex,
  UTxO,
} from "@meshsdk/core";

import { initializeBlockchainProvider } from "../_api/utils";

import { uid } from "../_components/Toast";
import { Oracle } from "../types/Oracle";

function now(): string {
  return new Date().toISOString();
}

const oracleCode =
  "590480010100229800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400530080024888966002600460106ea800e264664530011323259800980198069baa009899192cc004c014c03cdd5000c4cc8966002601730013756600c60246ea8c018c048dd50014dd7180a98091baa301530123754031375c600c60246ea8c054c048dd500c20028992cc004c030c048dd5000c4cc88c96600260340031325980098084c004dd59805980b9baa0019bae301a301737546034602e6ea80766eb8c02cc05cdd5180d180b9baa01d401915980080544c8c966002601c00314a11598009809000c4c8c966002602060346ea8006264b30013011301b3754003132598009810800c4c9289bad30200018b203c301c3754003164068603c60366ea80062c80c8cc8966002602a60366ea80062646600200200644b30010018a6103d87a80008992cc006600266ebc00530103d87a8000a50a51407510018998018019811801203a325980099b8748010c078dd5000c4c96600266e3cdca1bb30010078980919811000a5eb822980103d87a800040786044603e6ea80062980103d87a800040746014603c6ea8c08400501f4400501a1980e00225eb80c8c8cc004004dd5980f9810181018101810181018101810181018101810180e1baa0142259800800c00e2646644b30013372200e00515980099b8f0070028980919811000a5eb8200c80f226600a00a604800880f0dd7180e800980f0009810000a03c14c103d87a8000375c603860326ea800a264944dd6980e180c9baa002405c80b8c05cdd50009801980b9baa0018a504055164054603200316405c64660020026eb0c008c058dd5007112cc004006297ae0899912cc004c966002602660326ea8006266e3c01cdd7180e980d1baa0018a504060603860326ea8c070c064dd500144cc06c008cc01001000626600800800280b8c068004c06c0050181bae3016301337540024602e60306030003164044602a60246ea8c054c048dd5180318091baa0028b20203013301037540024446466446600400400244b3001001801c4c8cc896600266e4401c00a2b30013371e00e0051001803202e899802802980e802202e375c602c0026eb4c05c004c064005017191919800800803112cc00400600713233225980099b910090028acc004cdc78048014400600c80c226600a00a603c00880c0dd7180b8009bab3018001301a0014060297adef6c601480022c8070c8cc004004dd6180998081baa0082259800800c530103d87a80008992cc004cdd7980a98091baa001008898021980a000a5eb82266006006602c0048080c0500050121ba54800220028060c8cc88cc008008004896600200314a115980099b8f375c602600200714a3133002002301400140388088dd618089809180918091809180918091809180918071baa006375c6002601a6ea804c8c040c04400660166ea801e601e60200069112cc004c01000a2b3001300f37540150038b20208acc004c02000a2b3001300f37540150038b20208b201a4034300d001370e900018049baa0038b200e180400098019baa0088a4d1365640041";

const nftCode =
  "5901120101002229800aba2aba1aab9faab9eaab9dab9a9bae002488888896600264646644b30013370e900018039baa00189991192cc004c038006264b300132330010013758601e00844b30010018a508acc004cdd7980818071baa30100010148a518998010011808800a018403d15980099b8748008dd69806000c4cdc79bae300b0010098a50402914a08050c0340062c8060c8c8cc004004dd598071807980798079807801912cc00400600713233225980099b910080028acc004cdc78040014400600c807226600a00a60260088070dd718068009bab300e001300f0014038297adef6c60375c601460106ea8004c020dd51805002459006180400098041804800980400098021baa0088a4d1365640081";

export async function deployOracleTransaction(
  wallet: IWallet,
  oracleName: string,
  oracleDescription: string,
  tokenName: string,
  latestValue: number,
): Promise<Oracle> {
  const changeAddress = await wallet.getChangeAddress();
  const changePKH = deserializeAddress(changeAddress).pubKeyHash;

  const collateral = await wallet.getCollateral();
  const ownerUtxo = (await wallet.getUtxos()).filter(
    (utxo) => !collateral.includes(utxo),
  )[0];
  const codeWithParams = applyParamsToScript(
    applyCborEncoding(nftCode),

    [
      mConStr0([ownerUtxo.input.txHash, ownerUtxo.input.outputIndex]),
      tokenName,
    ],
  );
  const mintingPolicy = resolveScriptHash(codeWithParams, "V3");

  const oracleScript: PlutusScript = {
    code: applyParamsToScript(applyCborEncoding(oracleCode), [
      mConStr0([mConStr0([mintingPolicy, tokenName]), changePKH]),
    ]),
    version: "V3",
  };
  const oracleAddress = serializePlutusScript(oracleScript);
  const utxos = wallet.getUtxos();

  const tokenNameHex = stringToHex(tokenName);

  const nftScript: PlutusScript = {
    code: codeWithParams,
    version: "V3",
  };

  const provider = initializeBlockchainProvider();
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
  });
  const unsignedTx = await txBuilder
    .changeAddress(changeAddress)
    .txOut(oracleAddress.address, [])
    .txOutReferenceScript(oracleScript.code, "V3")
    .txOut(oracleAddress.address, [
      { unit: mintingPolicy + tokenNameHex, quantity: "1" },
    ])
    .txOutInlineDatumValue(integer(latestValue), "JSON")
    .selectUtxosFrom(await utxos)
    .mintPlutusScriptV3()
    .mint("1", mintingPolicy, tokenNameHex)
    .mintRedeemerValue(mConStr0([]))
    .mintingScript(nftScript.code)
    .txInCollateral(collateral[0].input.txHash, collateral[0].input.outputIndex)
    .txIn(ownerUtxo.input.txHash, ownerUtxo.input.outputIndex)
    .complete();
  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);
  const fresh: Oracle = {
    id: uid(txHash),
    policyId: mintingPolicy,
    assetName: tokenName,
    firstUtxo: ownerUtxo,
    oracleAddress: oracleAddress.address,
    name: oracleName || "Nuevo Oracle",
    description: oracleDescription || "",
    latestValue: Number(latestValue ?? 0),
    status: "active",
    lastUpdated: now(),
    history: [{ t: Date.now(), v: { value: 1, transactionHash: txHash } }],
  };
  return fresh;
}

export async function updateOracleTransaction(
  wallet: IWallet,
  provider: BlockfrostProvider,
  mintingPolicy: string,
  tokenName: string,
  oracleAddress: string,
  oracleUtxo: UTxO,
  newValue: number,
) {
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
  });
  const tokenNameHex = stringToHex(tokenName);

  const changeAddress = await wallet.getChangeAddress();

  const changePKH = deserializeAddress(changeAddress).pubKeyHash;

  const oracleScript: PlutusScript = {
    code: applyParamsToScript(applyCborEncoding(oracleCode), [
      mConStr0([mConStr0([mintingPolicy, tokenName]), changePKH]),
    ]),
    version: "V3",
  };

  const utxos = await wallet.getUtxos();
  const oracleHash = resolveScriptHash(oracleScript.code, "V3");
  const oracleUtxos = (await provider.fetchAddressUTxOs(oracleAddress)).filter(
    (u) => u.output.scriptRef != undefined,
  );
  if (oracleUtxos[0].output.scriptRef == undefined) return "";

  const collateral = await wallet.getCollateral();
  const unsignedTx = await txBuilder
    .setNetwork("preprod")

    .spendingPlutusScriptV3()
    .txIn(
      oracleUtxo.input.txHash,
      oracleUtxo.input.outputIndex,
      oracleUtxo.output.amount,
      oracleUtxo.output.address,
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(mConStr0([]))

    //.txInScript(oracleScript.code)

    .spendingTxInReference(
      oracleUtxos[0].input.txHash,
      oracleUtxos[0].input.outputIndex,
      (oracleUtxos[0].output.scriptRef.length / 2).toString(),
      oracleHash,
    )
    .selectUtxosFrom(utxos)
    .changeAddress(changeAddress)
    .txInCollateral(
      collateral[0].input.txHash,
      collateral[0].input.outputIndex,
      collateral[0].output.amount,
      collateral[0].output.address,
    )
    .txOut(oracleAddress, [
      { unit: mintingPolicy + tokenNameHex, quantity: "1" },
    ])
    .txOutInlineDatumValue(integer(newValue), "JSON")
    .requiredSignerHash(changePKH)

    .complete();

  const signedTx = await wallet.signTx(unsignedTx, true);
  const txHash = await wallet.submitTx(signedTx);
  return txHash;
}

export async function deleteOracleTransaction(
  wallet: IWallet,
  provider: BlockfrostProvider,
  mintingPolicy: string,
  tokenName: string,
  oracleUtxo: UTxO,
) {
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
  });
  const changeAddress = await wallet.getChangeAddress();
  const changePKH = deserializeAddress(changeAddress).pubKeyHash;

  const oracleScript: PlutusScript = {
    code: applyParamsToScript(applyCborEncoding(oracleCode), [
      mConStr0([mConStr0([mintingPolicy, tokenName]), changePKH]),
    ]),
    version: "V3",
  };

  const utxos = await wallet.getUtxos();

  const oracleAddress = serializePlutusScript(oracleScript).address;
  const oracleHash = resolveScriptHash(oracleScript.code, "V3");
  const oracleUtxos = (await provider.fetchAddressUTxOs(oracleAddress)).filter(
    (u) => u.output.scriptRef != undefined,
  );
  if (oracleUtxos[0].output.scriptRef == undefined) return "";

  const collateral = await wallet.getCollateral();
  const unsignedTx = await txBuilder
    .setNetwork("preprod")

    .spendingPlutusScriptV3()
    .txIn(
      oracleUtxo.input.txHash,
      oracleUtxo.input.outputIndex,
      oracleUtxo.output.amount,
      oracleUtxo.output.address,
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(mConStr1([]))

    // .txInScript(oracleScript.code)

    .spendingTxInReference(
      oracleUtxos[0].input.txHash,
      oracleUtxos[0].input.outputIndex,
      (oracleUtxos[0].output.scriptRef.length / 2).toString(),
      oracleHash,
    )

    .selectUtxosFrom(utxos)
    .changeAddress(changeAddress)
    .txInCollateral(
      collateral[0].input.txHash,
      collateral[0].input.outputIndex,
      collateral[0].output.amount,
      collateral[0].output.address,
    )
    .requiredSignerHash(changePKH)

    .complete();

  const signedTx = await wallet.signTx(unsignedTx, true);
  await wallet.submitTx(signedTx);
}
