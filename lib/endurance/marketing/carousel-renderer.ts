import "server-only";
import { renderCarouselHTML, CAROUSEL_VIEW_WIDTH, CAROUSEL_VIEW_HEIGHT } from "./carousel-html";
import { putObject } from "@/lib/storage";
import type { SlideData, BrandKitData } from "./types";

export interface RenderResult {
  campaignId: string;
  slidePaths: string[]; // URLs públicas (storage local /campaigns/... ou S3/R2)
}

const TOTAL = 7;
const SCALE = 1080 / CAROUSEL_VIEW_WIDTH; // 2.5714...

export async function renderCarouselToPNGs(
  campaignId: string,
  slides: SlideData[],
  brand: BrandKitData,
): Promise<RenderResult> {
  const html = renderCarouselHTML(slides, brand);

  // Lazy-import Playwright (Node-only, never bundled)
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: CAROUSEL_VIEW_WIDTH, height: CAROUSEL_VIEW_HEIGHT },
      deviceScaleFactor: SCALE,
    });

    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000); // aguarda Google Fonts

    // Prepara o frame para exportação
    await page.evaluate(`(() => {
      const el = (s) => document.querySelector(s);
      ['.ig-header','.ig-dots','.ig-actions','.ig-caption'].forEach(s=>{ const e=el(s); if(e) e.style.display='none'; });
      const f = el('.ig-frame');
      if(f) f.style.cssText='width:${CAROUSEL_VIEW_WIDTH}px;height:${CAROUSEL_VIEW_HEIGHT}px;max-width:none;border-radius:0;box-shadow:none;overflow:hidden;margin:0;';
      const v = el('.carousel-viewport');
      if(v) v.style.cssText='width:${CAROUSEL_VIEW_WIDTH}px;height:${CAROUSEL_VIEW_HEIGHT}px;aspect-ratio:unset;overflow:hidden;cursor:default;';
      document.body.style.cssText='padding:0;margin:0;display:block;overflow:hidden;background:#fff;';
    })()`);
    await page.waitForTimeout(300);

    const slidePaths: string[] = [];
    for (let i = 0; i < TOTAL; i++) {
      await page.evaluate(`((idx) => {
        const track = document.querySelector('.carousel-track');
        if(track){ track.style.transition='none'; track.style.transform='translateX('+(-(idx)*${CAROUSEL_VIEW_WIDTH})+'px)'; }
      })(${i})`);
      await page.waitForTimeout(200);

      const buf = await page.screenshot({
        clip: { x: 0, y: 0, width: CAROUSEL_VIEW_WIDTH, height: CAROUSEL_VIEW_HEIGHT },
      });
      const { url } = await putObject(
        `campaigns/${campaignId}/slide_${i + 1}.png`,
        buf,
        "image/png",
      );
      slidePaths.push(url);
    }

    return { campaignId, slidePaths };
  } finally {
    await browser.close();
  }
}
