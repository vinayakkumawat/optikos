import { useEffect, useRef, useState } from "react";
import type { Snapshot } from "./types";

type ConnState = "connecting" | "live" | "reconnecting";

export function useSensing() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const retry = useRef<number>(0);

  useEffect(() => {
    let closed = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        retry.current = 0;
        setConn("live");
      };
      ws.onmessage = (ev) => {
        try {
          setSnapshot(JSON.parse(ev.data) as Snapshot);
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        if (closed) return;
        setConn("reconnecting");
        retry.current = Math.min(retry.current + 1, 6);
        setTimeout(connect, 400 * retry.current);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      wsRef.current?.close();
    };
  }, []);

  const recalibrate = async () => {
    try {
      await fetch("/api/recalibrate", { method: "POST" });
    } catch {
      /* ignore */
    }
  };

  return { snapshot, conn, recalibrate };
}
