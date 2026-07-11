import { useEffect } from "react";
import { useSimStore } from "../store/simStore";
import type { Frame } from "./types";

export function useRunSocket(runId: string | null) {
  const applyFrame = useSimStore((s) => s.applyFrame);

  useEffect(() => {
    if (!runId) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/api/runs/${runId}/ws`);
      ws.onmessage = (msg) => {
        try {
          applyFrame(JSON.parse(msg.data) as Frame);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [runId, applyFrame]);
}
