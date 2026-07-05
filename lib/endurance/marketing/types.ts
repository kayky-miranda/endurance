export type SlideLayout =
  | "hero"
  | "problem"
  | "solution"
  | "features"
  | "details"
  | "steps"
  | "cta";

export type SlideBackground = "light" | "dark" | "gradient";

export interface SlideBullet {
  icon: string;
  label: string;
  desc: string;
}

export interface SlideData {
  index: number;
  layout: SlideLayout;
  background: SlideBackground;
  tag: string;
  headline: string;
  body: string;
  bullets?: SlideBullet[];
  steps?: { num: string; title: string; desc: string }[];
  ctaText?: string;
}

export interface BrandKitData {
  primaryColor: string;
  darkColor: string;
  lightColor: string;
  lightBg: string;
  darkBg: string;
  fontHeading: string;
  fontBody: string;
  logoText: string;
  tagline: string;
  instagramHandle: string;
}

export interface CampaignContent {
  slides: SlideData[];
  brand: BrandKitData;
}

export interface GenerateCarouselInput {
  prompt: string;
  niche: string;
  orgName: string;
  orgKit?: Partial<BrandKitData>;
}
