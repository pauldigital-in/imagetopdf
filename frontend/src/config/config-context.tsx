import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { storage } from "@/src/utils/storage";
import { AppConfig, DEFAULT_CONFIG, mergeValidConfig } from "./defaults";

const CACHE_KEY = "remote_config_v1";
const REFRESH_MS = 6 * 60 * 60 * 1000; // 6 hours
const TIMEOUT_MS = 5000;

const CONFIG_URL = process.env.EXPO_PUBLIC_CONFIG_URL ?? "";

type Cached = { config: AppConfig; fetchedAt: number };

type ConfigContextValue = {
  config: AppConfig;
  refresh: () => Promise<void>;
};

const ConfigContext = createContext<ConfigContextValue>({
  config: DEFAULT_CONFIG,
  refresh: async () => {},
});

export function useAppConfig() {
  return useContext(ConfigContext);
}

async function fetchRemote(base: AppConfig): Promise<AppConfig | null> {
  if (!CONFIG_URL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CONFIG_URL, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Support either the raw config or { config: {...} } envelope.
    const payload = json && typeof json === "object" && "config" in json ? (json as any).config : json;
    return mergeValidConfig(base, payload);
  } catch {
    return null; // offline / timeout / bad data => keep last known good
  } finally {
    clearTimeout(timer);
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const lastGood = useRef<AppConfig>(DEFAULT_CONFIG);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const next = await fetchRemote(lastGood.current);
    if (next) {
      lastGood.current = next;
      setConfig(next);
      await storage.setItem(CACHE_KEY, {
        config: next as any,
        fetchedAt: Date.now(),
      } as any);
    }
    inFlight.current = false;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      // 1. Load last-known-good from cache immediately (offline resilience).
      const cached = await storage.getItem<Cached | null>(CACHE_KEY, null);
      if (active && cached?.config) {
        const merged = mergeValidConfig(DEFAULT_CONFIG, cached.config) ?? DEFAULT_CONFIG;
        lastGood.current = merged;
        setConfig(merged);
      }
      // 2. Refresh from network in the background if stale (never blocks UI).
      const stale = !cached || Date.now() - cached.fetchedAt > REFRESH_MS;
      if (stale) void refresh();
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  return (
    <ConfigContext.Provider value={{ config, refresh }}>
      {children}
    </ConfigContext.Provider>
  );
}
