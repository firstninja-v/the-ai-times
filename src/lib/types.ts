export type ColorMode = "bw" | "color";

export type PuzzleTypeId =
  | "crossword"
  | "sudoku"
  | "wordsearch"
  | "cryptogram"
  | "trivia";

export type PuzzleDifficulty = "easy" | "medium" | "hard";

export type PaperTitleStyle =
  | "the-times"
  | "daily-news"
  | "the-herald"
  | "morning-edition"
  | "the-post"
  | "custom";

export type PaperKind = "personal" | "company";

export type LlmProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "ollama"
  | "custom";

export interface CompanyInfo {
  companyName: string;
  industry?: string;
  keywords: string[];
  competitors?: string[];
  pressUrls?: string[];
  website?: string;
}

export interface ByokConfig {
  enabled: boolean;
  provider: LlmProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface PrinterSettings {
  paperSize: "A4" | "Letter" | "Tabloid";
  colorMode: ColorMode;
  duplex: boolean;
  copies: number;
  orientation: "portrait" | "landscape";
  autoPrint: boolean;
}

export interface PrinterDevice {
  id: string;
  name: string;
  driver: "cups" | "ipp" | "file";
  uri?: string;
  isDefault?: boolean;
  supportsColor?: boolean;
  paperSizes?: string[];
  duplex?: boolean;
  status?: string;
  settings?: PrinterSettings;
}

export interface UserProfile {
  kind: PaperKind;
  name: string;
  email: string;
  titleStyle: PaperTitleStyle;
  customTitle?: string;
  interests: string[];
  newsPrompt?: string;
  byok?: ByokConfig;
  colorMode: ColorMode;
  preferredFont?: "georgia" | "newsreader" | "libre" | "helvetica" | "system";
  preferredTemplate?: "classic" | "modern" | "compact" | "broadsheet" | "magazine";
  puzzles?: PuzzleTypeId[];
  puzzleDifficulty?: PuzzleDifficulty;
  emailTime: string;
  printEnabled: boolean;
  printTime: string;
  printerId?: string;
  timezone: string;
  pageCount: "auto" | number;
  breakingNews: boolean;
  company?: CompanyInfo;
  createdAt: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
  breaking?: boolean;
  imageUrl?: string;
  score?: number;
  providerId?: string;
  tier?: string;
}

export interface NewspaperEdition {
  id: string;
  paperTitle: string;
  dateLabel: string;
  generatedAt: string;
  colorMode: ColorMode;
  pages: EditionPage[];
  articles: NewsArticle[];
  kind?: PaperKind;
  companyName?: string;
}

export interface EditionPage {
  number: number;
  sections: EditionSection[];
}

export interface EditionSection {
  heading?: string;
  articles: NewsArticle[];
  layout: "lead" | "column" | "brief";
}
