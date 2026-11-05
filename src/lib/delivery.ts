export type PauseMode = "print" | "all";

export type DeliveryState = {
  /** When true, morning print (and optionally email) is skipped until resumed */
  paused: boolean;
  /** print = skip printer only (email still sends); all = skip generate/email/print */
  pauseMode: PauseMode;
  /** The home/office printer the user connected once */
  printerId: string | null;
  printerName: string | null;
  printerConnectedAt: string | null;
  updatedAt?: string;
};

export const DELIVERY_KEY = "ai-times.delivery";

export const DEFAULT_DELIVERY: DeliveryState = {
  paused: false,
  pauseMode: "print",
  printerId: null,
  printerName: null,
  printerConnectedAt: null,
};

export function loadDeliveryLocal(): DeliveryState {
  if (typeof window === "undefined") return structuredClone(DEFAULT_DELIVERY);
  try {
    const raw = localStorage.getItem(DELIVERY_KEY);
    if (!raw) return structuredClone(DEFAULT_DELIVERY);
    return { ...structuredClone(DEFAULT_DELIVERY), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_DELIVERY);
  }
}

export function saveDeliveryLocal(state: DeliveryState) {
  localStorage.setItem(DELIVERY_KEY, JSON.stringify(state));
}
