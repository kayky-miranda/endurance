import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";

const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const serif = loadSerif("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export const FONT = {
  body: inter.fontFamily, // Inter
  serif: serif.fontFamily, // Instrument Serif
};
