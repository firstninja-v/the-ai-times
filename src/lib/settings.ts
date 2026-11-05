export type EmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
};

export type SlackSettings = {
  enabled: boolean;
  webhookUrl: string;
};

export type WhatsAppSettings = {
  enabled: boolean;
  /** E.164 without + for wa.me, or leave blank to open share sheet text only */
  phone: string;
};

export type ShareSettings = {
  slack: SlackSettings;
  whatsapp: WhatsAppSettings;
  copyLink: boolean;
};

export type DeliveryAgent = {
  id: string;
  name: string;
  enabled: boolean;
  emailTime: string;
  printTime: string;
  printEnabled: boolean;
  printerId?: string;
  timezone: string;
  createdAt: string;
};

export type AppSettings = {
  email: EmailSettings;
  share: ShareSettings;
  agents: DeliveryAgent[];
  updatedAt?: string;
};

export const SETTINGS_KEY = "ai-times.settings";

export const DEFAULT_SETTINGS: AppSettings = {
  email: {
    enabled: false,
    host: "smtp.gmail.com",
    port: 587,
    user: "",
    pass: "",
    from: "",
    secure: false,
  },
  share: {
    slack: { enabled: false, webhookUrl: "" },
    whatsapp: { enabled: false, phone: "" },
    copyLink: true,
  },
  agents: [],
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    return { ...structuredClone(DEFAULT_SETTINGS), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettingsLocal(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
