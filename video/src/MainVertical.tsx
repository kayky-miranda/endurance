import { AbsoluteFill, Sequence, Series, Audio, staticFile, useCurrentFrame, interpolate } from "remotion";
import { BackgroundVertical } from "./components/BackgroundVertical";
import { V1Intro } from "./scenes-vertical/V1Intro";
import { V2Dor } from "./scenes-vertical/V2Dor";
import { V3Agitacao } from "./scenes-vertical/V3Agitacao";
import { V4Solucao } from "./scenes-vertical/V4Solucao";
import { V5Onboarding } from "./scenes-vertical/V5Onboarding";
import { V6Modulos } from "./scenes-vertical/V6Modulos";
import { V7IA } from "./scenes-vertical/V7IA";
import { V8Payoff } from "./scenes-vertical/V8Payoff";
import { V9CTA } from "./scenes-vertical/V9CTA";
import { SCENE_FRAMES, COLORS } from "./theme";

const NARRATION = [
  "audio/v1-s01.mp3",
  "audio/v1-s02.mp3",
  "audio/v1-s03.mp3",
  "audio/v1-s04.mp3",
  "audio/v1-s05.mp3",
  "audio/v1-s06.mp3",
  "audio/v1-s07.mp3",
  "audio/v1-s08.mp3",
  "audio/v1-s09.mp3",
];

const SCENES = [
  { C: V1Intro, d: SCENE_FRAMES.intro },
  { C: V2Dor, d: SCENE_FRAMES.dor },
  { C: V3Agitacao, d: SCENE_FRAMES.agitacao },
  { C: V4Solucao, d: SCENE_FRAMES.solucao },
  { C: V5Onboarding, d: SCENE_FRAMES.onboarding },
  { C: V6Modulos, d: SCENE_FRAMES.modulos },
  { C: V7IA, d: SCENE_FRAMES.ia },
  { C: V8Payoff, d: SCENE_FRAMES.payoff },
  { C: V9CTA, d: SCENE_FRAMES.cta },
];

const FlashOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const starts: number[] = [];
  SCENES.reduce((acc, s, i) => {
    starts[i] = acc;
    return acc + s.d;
  }, 0);

  let flashOpacity = 0;
  for (let i = 1; i < starts.length; i++) {
    const t = starts[i];
    if (frame >= t - 3 && frame <= t + 3) {
      flashOpacity = Math.max(
        flashOpacity,
        interpolate(frame, [t - 3, t, t + 3], [0, 0.35, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
    }
  }

  if (flashOpacity <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.emerald,
        opacity: flashOpacity,
        zIndex: 20,
        pointerEvents: "none",
      }}
    />
  );
};

export const MainVertical: React.FC = () => {
  const starts: number[] = [];
  SCENES.reduce((acc, s, i) => {
    starts[i] = acc;
    return acc + s.d;
  }, 0);

  return (
    <AbsoluteFill>
      <BackgroundVertical />

      <Series>
        {SCENES.map(({ C, d }, i) => (
          <Series.Sequence key={i} durationInFrames={d}>
            <C />
          </Series.Sequence>
        ))}
      </Series>

      <FlashOverlay />

      {NARRATION.map((src, i) => (
        <Sequence key={src} from={starts[i]}>
          <Audio src={staticFile(src)} />
        </Sequence>
      ))}

      <Sequence from={30}>
        <Audio src={staticFile("audio/music/background.mp3")} volume={0.22} />
      </Sequence>
    </AbsoluteFill>
  );
};
