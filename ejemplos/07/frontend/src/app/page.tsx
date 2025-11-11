"use client";
import { useMemo, useState } from "react";
import "@meshsdk/react/styles.css";

import { useWallet } from "@meshsdk/react";
import {
  deleteOracleTransaction,
  deployOracleTransaction,
  updateOracleTransaction,
} from "./transactions/tx";
import { Oracle } from "./types/Oracle";

import {
  applyCborEncoding,
  applyParamsToScript,
  mConStr0,
  resolveScriptHash,
  stringToHex,
} from "@meshsdk/core";
import { initializeBlockchainProvider } from "./_api/utils";
import { Badge } from "./_components/Badge";
import { Card } from "./_components/Card";
import { CardHeader } from "./_components/CardHeader";
import { CardBody } from "./_components/CardBody";
import { Button } from "./_components/Button";
import { Input } from "./_components/Input";
import { Select } from "./_components/Select";
import { Confirm } from "./_components/Confirm";
import { Navbar } from "./_components/Navbar";
import { uid, useToasts } from "./_components/Toast";

const DEMO_NOW_ISO = "2025-01-01T00:00:00.000Z";
const now = () => DEMO_NOW_ISO;
const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 });
const LOCALE = "es-MX";
const TIMEZONE = "America/Buenos_Aires";
const fmtDate = (d: string | number) =>
  new Date(d).toLocaleString(LOCALE, { hour12: false, timeZone: TIMEZONE });

const SEED_ORACLES: Oracle[] = [];

export default function OracleAppication() {
  const { push, Toasts } = useToasts();
  const [tab, setTab] = useState<
    "dashboard" | "deploy" | "update" | "delete" | "query" | "activity"
  >("dashboard");
  const [oracles, setOracles] = useState<Oracle[]>(SEED_ORACLES);
  const [busy, setBusy] = useState(false);
  const { connected, wallet } = useWallet();

  const nftCode =
    "5901120101002229800aba2aba1aab9faab9eaab9dab9a9bae002488888896600264646644b30013370e900018039baa00189991192cc004c038006264b300132330010013758601e00844b30010018a508acc004cdd7980818071baa30100010148a518998010011808800a018403d15980099b8748008dd69806000c4cdc79bae300b0010098a50402914a08050c0340062c8060c8c8cc004004dd598071807980798079807801912cc00400600713233225980099b910080028acc004cdc78040014400600c807226600a00a60260088070dd718068009bab300e001300f0014038297adef6c60375c601460106ea8004c020dd51805002459006180400098041804800980400098021baa0088a4d1365640081";

  const [selectedId, setSelectedId] = useState<string | null>(
    oracles[0]?.id ?? null,
  );
  const selected = useMemo(
    () => oracles.find((o) => o.id === selectedId) || null,
    [oracles, selectedId],
  );
  type LogItem = {
    id: string;
    kind: "deploy" | "update" | "delete" | "query";
    when: string;
    message: string;
  };
  const [log, setLog] = useState<LogItem[]>([
    {
      id: uid("log"),
      kind: "update",
      when: now(),
      message: "Actualización demo en ADA/USD",
    },
    {
      id: uid("log"),
      kind: "deploy",
      when: now(),
      message: "Despliegue demo de BTC/USD",
    },
  ]);
  const addLog = (kind: LogItem["kind"], message: string) =>
    setLog((l) => [{ id: uid("log"), kind, when: now(), message }, ...l]);

  async function deployOracle(payload: Partial<Oracle>) {
    setBusy(true);
    if (!connected) {
      push("Debes conectar tu wallet primero", "");
      setBusy(false);
      return;
    }

    const newOracle = await deployOracleTransaction(
      wallet,
      payload.name || "name",
      payload.description || "description",
      payload.assetName || "TOKEN",
      payload.latestValue || 1,
    );
    setUpdateForm({
      oracleId: newOracle.id,
      newValue: newOracle.latestValue,
      metadata: "",
    });
    setOracles((o) => [newOracle, ...o]);
    setSelectedId(newOracle.id);
    addLog("deploy", `Oracle desplegado: ${newOracle.name}`);
    push(
      "Oracle desplegado",
      `${newOracle.name} listo para conectar con tus transacciones.`,
    );
    setBusy(false);
  }

  async function updateOracle(id: string, value: number, meta?: string) {
    setBusy(true);
    const target = oracles.find((o) => o.id == id);
    const mintingPolicy = target?.policyId;
    const tokenName = target?.assetName;
    const oracleAddress = target?.oracleAddress;

    const lastTx = target?.history?.at(target?.history?.length - 1);

    if (
      oracleAddress != undefined &&
      tokenName != undefined &&
      lastTx != undefined &&
      mintingPolicy != undefined
    ) {
      const tokenNameHex = stringToHex(tokenName);

      const provider = initializeBlockchainProvider();
      const oracleUtxo = (
        await provider.fetchAddressUTxOs(oracleAddress)
      ).filter(
        (utxo) =>
          utxo.output.amount.some(
            (a) => a.unit == mintingPolicy + tokenNameHex,
          ) && utxo.input.txHash == lastTx.v.transactionHash,
      );

      if (!connected) {
        push("Debes conectar tu wallet primero");
        setBusy(false);
        return;
      }

      if (oracleUtxo.length > 0) {
        try {
          const txHash = await updateOracleTransaction(
            wallet,
            provider,
            mintingPolicy,
            tokenName,
            oracleAddress,
            oracleUtxo[0],
            value,
          );
          //const txHash = await wallet.submitTx(signedTx);
          if (txHash != "") {
            setOracles((list) =>
              list.map((o) =>
                o.id !== id
                  ? o
                  : {
                      ...o,
                      latestValue: value,
                      lastUpdated: now(),
                      history: [
                        ...o.history.slice(-59),
                        {
                          t: Date.now(),
                          v: { value: value, transactionHash: txHash },
                        },
                      ],
                      description: meta || o.description,
                    },
              ),
            );

            addLog("update", `Actualización en ${id} → ${value}`);
            push("Oracle actualizado", `Nuevo valor: ${value}`);
            setBusy(false);
          } else {
            push("Error actualizando el Oracle");
            setBusy(false);
          }
        } catch {
          push("Intenté firmar pero no se pudo");
          setBusy(false);
        }
      } else {
        push("La última transacción del Oracle aún no ha sido confirmada");
        setBusy(false);
      }
    } else {
      push("Faltan datos");
      setBusy(false);
    }
  }

  async function deleteOracle(id: string) {
    setBusy(true);

    const target = oracles.find((o) => o.id == id);
    const mintingPolicy = target?.policyId;
    const tokenName = target?.assetName;
    const oracleAddress = target?.oracleAddress;
    const lastTx = target?.history?.at(target?.history?.length - 1);
    const ownerUtxo = target?.firstUtxo;

    if (
      oracleAddress != undefined &&
      tokenName != undefined &&
      lastTx != undefined &&
      mintingPolicy != undefined &&
      ownerUtxo != undefined
    ) {
      const tokenNameHex = stringToHex(tokenName);

      const codeWithParams = applyParamsToScript(
        applyCborEncoding(nftCode),

        [
          mConStr0([ownerUtxo.input.txHash, ownerUtxo.input.outputIndex]),
          tokenName,
        ],
      );
      const mintingPolicy = resolveScriptHash(codeWithParams, "V3");

      const provider = initializeBlockchainProvider();
      const oracleUtxo = (
        await provider.fetchAddressUTxOs(oracleAddress)
      ).filter(
        (utxo) =>
          utxo.output.amount.some(
            (a) => a.unit == mintingPolicy + tokenNameHex,
          ) && utxo.input.txHash == lastTx.v.transactionHash,
      );

      if (!connected) {
        push("Debes conectar tu wallet primero");
        setBusy(false);
        return;
      }

      if (oracleUtxo.length > 0) {
        await deleteOracleTransaction(
          wallet,
          provider,
          mintingPolicy,
          tokenName,
          oracleUtxo[0],
        );
        //await wallet.submitTx(signedTx);
        try {
          const victim = oracles.find((o) => o.id === id);
          setOracles((list) => list.filter((o) => o.id !== id));
          if (selectedId === id) {
            setSelectedId(oracles.find((o) => o.id !== id)?.id || null);
            setUpdateForm({
              oracleId: oracles.find((o) => o.id !== id)?.id || "",
              newValue: 7,
              metadata: "",
            });
          }

          addLog("delete", `Eliminado ${victim?.name || id}`);
          push("Oracle eliminado", victim?.name || id);
          setBusy(false);
        } catch {
          push("Intenté firmar pero no se pudo");
          setBusy(false);
        }
      } else {
        push("La última transacción del Oracle aún no ha sido confirmada");
        setBusy(false);
      }
    } else {
      push("update", "No fue posible actualizar el oracle");
      setBusy(false);
    }
  }

  const [deployForm, setDeployForm] = useState({
    name: "Nombre del Oracle",
    assetName: "TOKEN NAME",
    policyId: "",
    unit: "USD",
    decimals: 6,
    latestValue: 1.0,
    updateFrequency: "5m",
    minterAddress: "addr1...",
    description: "Feed de ejemplo para pruebas locales.",
  });

  const [updateForm, setUpdateForm] = useState({
    oracleId: selectedId || "",
    newValue: selected?.latestValue || 1,
    metadata: "",
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Top bar */}
      <Navbar />

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-6">
        <nav className="mt-6 flex flex-wrap items-center gap-2">
          {[
            ["dashboard", "Oráculos"],
            ["deploy", "Desplegar"],
            ["update", "Actualizar"],
            ["delete", "Eliminar"],
            ["activity", "Actividad"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${tab === key ? "bg-slate-900 text-white" : "bg-neutral-900 text-neutral-200 ring-1 ring-slate-200 hover:bg-neutral-950"}`}
            >
              {label}
            </button>
          ))}
          <button onClick={() => setBusy(false)}>Reestablecer</button>
        </nav>

        {/* Content */}
        <div className="my-6 grid gap-6">
          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader title="Oráculos activos" />
                  <CardBody>
                    <div className="text-3xl font-semibold">
                      {oracles.filter((o) => o.status === "active").length}
                    </div>
                    <p className="mt-2 text-sm text-neutral-300">
                      En servicio actualmente.
                    </p>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Última actualización" />
                  <CardBody>
                    <div className="text-3xl font-semibold">
                      {fmtDate(oracles[0]?.lastUpdated)}
                    </div>
                    <p className="mt-2 text-sm text-neutral-300">
                      Del feed más reciente.
                    </p>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Total de feeds" />
                  <CardBody>
                    <div className="text-3xl font-semibold">
                      {oracles.length}
                    </div>
                    <p className="mt-2 text-sm text-neutral-300">
                      Incluye pausados.
                    </p>
                  </CardBody>
                </Card>
              </div>

              <Card>
                <CardHeader
                  title="Listado de Oráculos"
                  subtitle="Gestiona, edita o inspecciona cada feed"
                  right={
                    <Button kind="primary" onClick={() => setTab("deploy")}>
                      + Nuevo Oracle
                    </Button>
                  }
                />
                <CardBody>
                  <div className="overflow-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="text-neutral-400">
                          <th className="px-3 py-2">Nombre</th>
                          <th className="px-3 py-2">Asset</th>
                          <th className="px-3 py-2">PolicyId</th>
                          <th className="px-3 py-2">Valor</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2">Actualizado</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {oracles.map((o) => (
                          <tr
                            key={o.id}
                            className="border-t border-neutral-800/40"
                          >
                            <td className="px-3 py-3">
                              <div className="font-medium text-neutral-100">
                                {o.name}
                              </div>
                              <div className="text-xs text-neutral-400">
                                {o.description}
                              </div>
                            </td>
                            <td className="px-3 py-3 font-mono text-xs">
                              {o.assetName}
                            </td>
                            <td className="px-3 py-3 font-mono text-[11px] text-neutral-400">
                              {o.policyId.slice(0, 10)}…{o.policyId.slice(-6)}
                            </td>
                            <td className="px-3 py-3">
                              {fmt.format(o.latestValue)}
                            </td>
                            <td className="px-3 py-3">
                              {o.status === "active" && (
                                <Badge tone="green">activo</Badge>
                              )}
                              {o.status === "paused" && (
                                <Badge tone="yellow">pausado</Badge>
                              )}
                              {o.status === "retired" && (
                                <Badge tone="red">retirado</Badge>
                              )}
                            </td>
                            <td className="px-3 py-3 text-neutral-300">
                              {fmtDate(o.lastUpdated)}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  kind="secondary"
                                  onClick={() => {
                                    setSelectedId(o.id);
                                    setTab("update");
                                  }}
                                >
                                  Editar
                                </Button>
                                <Button
                                  kind="danger"
                                  onClick={() => {
                                    setPendingDeleteId(o.id);
                                    setConfirmOpen(true);
                                  }}
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </>
          )}

          {/* DEPLOY */}
          {tab === "deploy" && (
            <Card>
              <CardHeader
                title="Desplegar nuevo Oracle"
                subtitle="Completa los campos. No se envían transacciones en este modo demo."
              />
              <CardBody>
                <form
                  className="grid grid-cols-1 gap-5 md:grid-cols-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await deployOracle(deployForm);
                  }}
                >
                  <Input
                    label="Nombre"
                    required
                    value={deployForm.name}
                    onChange={(e) =>
                      setDeployForm({ ...deployForm, name: e.target.value })
                    }
                  />
                  <Input
                    label="Asset Name"
                    required
                    value={deployForm.assetName}
                    onChange={(e) =>
                      setDeployForm({
                        ...deployForm,
                        assetName: e.target.value.toUpperCase(),
                      })
                    }
                  />
                  <Input
                    label="Valor inicial"
                    type="number"
                    step="any"
                    value={deployForm.latestValue}
                    onChange={(e) => {
                      setDeployForm({
                        ...deployForm,
                        latestValue: Number(e.target.value),
                      });
                    }}
                  />
                  <div className="md:col-span-2 flex justify-end gap-3">
                    <Button type="submit" kind="primary" disabled={busy}>
                      Desplegar nuevo Oracle
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          {/* UPDATE */}
          {tab === "update" && (
            <Card>
              <CardHeader
                title="Actualizar Oracle"
                subtitle="Selecciona un feed y define el nuevo valor."
              />
              <CardBody>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Select
                    label="Oracle"
                    value={updateForm.oracleId}
                    onChange={(v) => {
                      setUpdateForm({ ...updateForm, oracleId: v });
                      setSelectedId(v);
                    }}
                    options={oracles.map((o) => ({
                      label: `${o.name} (${o.assetName})`,
                      value: o.id,
                    }))}
                  />
                  <Input
                    label="Nuevo valor"
                    type="number"
                    step="any"
                    value={updateForm.newValue}
                    onChange={(e) =>
                      setUpdateForm({
                        ...updateForm,
                        newValue: Number(e.target.value),
                      })
                    }
                  />
                  <div className="md:col-span-2 flex items-center justify-between">
                    {selected && (
                      <div className="text-sm text-neutral-300">
                        Actual:{" "}
                        <span className="font-mono">
                          {fmt.format(selected.latestValue)}
                        </span>{" "}
                        • Última: {fmtDate(selected.lastUpdated)}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button
                        kind="primary"
                        disabled={!updateForm.oracleId || busy}
                        onClick={() =>
                          updateOracle(
                            updateForm.oracleId,
                            updateForm.newValue,
                            updateForm.metadata,
                          )
                        }
                      >
                        Actualizar Oracle
                      </Button>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* DELETE */}
          {tab === "delete" && (
            <Card>
              <CardHeader
                title="Eliminar Oracle"
                subtitle="Acción destructiva. En demo solo elimina de la lista."
              />
              <CardBody>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Select
                    label="Oracle"
                    value={pendingDeleteId || selectedId || oracles[0]?.id}
                    onChange={(v) => setPendingDeleteId(v)}
                    options={oracles.map((o) => ({
                      label: `${o.name} (${o.assetName})`,
                      value: o.id,
                    }))}
                  />
                  <div className="flex items-end gap-3">
                    <Button
                      kind="danger"
                      onClick={() => {
                        setConfirmOpen(true);
                        if (!pendingDeleteId) setPendingDeleteId(selectedId);
                      }}
                    >
                      Eliminar
                    </Button>
                    <Button
                      kind="secondary"
                      onClick={() => setTab("dashboard")}
                    >
                      Volver
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* ACTIVITY */}
          {tab === "activity" && (
            <Card>
              <CardHeader
                title="Actividad"
                subtitle="Auditoría local de acciones"
              />
              <CardBody>
                <ul className="grid gap-3">
                  {log.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-neutral-800/60 bg-neutral-900 p-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          tone={
                            item.kind === "deploy"
                              ? "green"
                              : item.kind === "update"
                                ? "slate"
                                : item.kind === "delete"
                                  ? "red"
                                  : "yellow"
                          }
                        >
                          {item.kind}
                        </Badge>
                        <span className="text-neutral-100">{item.message}</span>
                      </div>
                      <span className="text-neutral-400">
                        {fmtDate(item.when)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Toasts />

      {/* Confirm dialog */}
      <Confirm
        open={confirmOpen}
        title="¿Eliminar Oracle?"
        desc="Esta acción no se puede deshacer. En demo solo se elimina del estado local."
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteOracle(pendingDeleteId);
          }
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
