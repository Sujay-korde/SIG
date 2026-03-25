"use client";

import { useEffect, useRef, useState } from "react";

export function useSSE<T>(url: string, onEvent: (data: T) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "reconnecting">("connecting");

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      eventSourceRef.current?.close();
      const source = new EventSource(url);
      eventSourceRef.current = source;
      setStatus((current) => (current === "connected" ? "connected" : "connecting"));

      source.onopen = () => {
        if (mounted) {
          setStatus("connected");
        }
      };

      source.onmessage = (event) => {
        if (!mounted) {
          return;
        }
        try {
          onEvent(JSON.parse(event.data) as T);
        } catch {
          // Ignore malformed keepalive payloads.
        }
      };

      source.onerror = () => {
        if (!mounted) {
          return;
        }
        setStatus("reconnecting");
        source.close();
        retryRef.current = window.setTimeout(connect, 1000);
      };
    };

    connect();
    return () => {
      mounted = false;
      eventSourceRef.current?.close();
      if (retryRef.current) {
        window.clearTimeout(retryRef.current);
      }
    };
  }, [onEvent, url]);

  return { status };
}
