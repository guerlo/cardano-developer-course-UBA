import React, { useEffect, useState, useCallback } from "react";
import { useWallet } from "@meshsdk/react";
import { IWallet, deserializeAddress } from "@meshsdk/core";
import { SetMessageFn, SetMessageTypeFn } from "../page";

import "@meshsdk/react/styles.css";

const getPKH = async (wallet: IWallet) => {
  const addr = await wallet.getChangeAddress();
  const { pubKeyHash } = deserializeAddress(addr);
  return pubKeyHash;
};

type PubKeyHashProps = {
  setMessage: SetMessageFn;
  setMessageType: SetMessageTypeFn;
};

export const PubKeyHash = ({ setMessage, setMessageType }: PubKeyHashProps) => {
  const { wallet, connected } = useWallet();
  const [pubKeyHash, setPubKeyHash] = useState("");

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(pubKeyHash)
      .then(() => {
        setMessage("Your Public Key Hash is in your clipboard!");
        setMessageType("success");
      })
      .catch((err) => {
        setMessage("Error : " + err);
        setMessageType("error");
      });
  }, [pubKeyHash]);

  useEffect(() => {
    if (connected) {
      getPKH(wallet)
        .then((res) => setPubKeyHash(res))
        .catch((err) => {
          setMessage(err);
          setMessageType("error");
        });
    }
  }, [connected]);
  if (connected) {
    return (
      <span
        onClick={handleCopy}
        style={{ cursor: "pointer" }}
        className="text-customFonts font-light text-xl text-white
           hover:opacity-80 hover:underline transition duration-200"
      >
        {pubKeyHash + "📋"}
      </span>
    );
  }
};
