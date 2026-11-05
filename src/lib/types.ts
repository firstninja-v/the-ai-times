export type ColorMode = "bw" | "color";

export type PaperTitleStyle =
  | "the-times"
  | "daily-news"
  | "the-herald"
  | "morning-edition"
  | "the-post"
  | "custom";

export interface UserProfile {
  name: string;
  email: string;
  titleStyle: PaperTitleStyle;
  customTitle?: string;
  interests: string[];
  colorMode: ColorMode;
  emailTime: string; // HH:mm local
  printEnabled: boolean;
  printTime: string; // HH:mm local
  timezone: string;
  pageCount: "auto" | number;
  breakingNews: boolean;
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
}

export interface NewspaperEdition {
  id: string;
  paperTitle: string;
  dateLabel: string;
  generatedAt: string;
  colorMode: ColorMode;
  pages: EditionPage[];
  articles: NewsArticle[];
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
