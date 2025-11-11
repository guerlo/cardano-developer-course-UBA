"use client";
import { useWallet } from "@meshsdk/react";

export function WalletPanel() {
  const { wallet, connected } = useWallet();
  return <p>¿Conectado? {connected ? "Sí" : "No"}</p>;
}
