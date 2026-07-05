import { AbsoluteFill, Sequence, Series, Audio, staticFile, useCurrentFrame, interpolate } from "remotion";
import { Background } from "./components/Background";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2Dor } from "./scenes/Scene2Dor";
import { Scene3Agitacao } from "./scenes/Scene3Agitacao";
import { Scene4Solucao } from "./scenes/Scene4Solucao";
import { Scene5Onboarding } from "./scenes/Scene5Onboarding";
import { Scene6Modulos } from "./scenes/Scene6Modulos";
import { Scene7IA } from "./scenes/Scene7IA";
import { Scene8Payoff } from "./scenes/Scene8Payoff";
import { Scene9CTA } from "./scenes/Scene9CTA";
import { SCENE_FRAMES, COLORS } from "./theme";

const HAS_NARRATION = true;
const HAS_MUSIC = true;

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
  { C: Scene1Intro, d: SCENE_FRAMES.intro },
  { C: Scene2Dor, d: SCENE_FRAMES.dor },
  { C: Scene3Agitacao, d: SCENE_FRAMES.agitacao },
  { C: Scene4Solucao, d: SCENE_FRAMES.solucao },
  { C: Scene5Onboarding, d: SCENE_FRAMES.onboarding },
  { C: Scene6Modulos, d: SCENE_FRAMES.modulos },
  { C: Scene7IA, d: SCENE_FRAMES.ia },
  { C: Scene8Payoff, d: SCENE_FRAMES.payoff },
  { C: Scene9CTA, d: SCENE_FRAMES.cta },
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

export const Main: React.FC = () => {
  const starts: number[] = [];
  SCENES.reduce((acc, s, i) => {
    starts[i] = acc;
    return acc + s.d;
  }, 0);

  return (
    <AbsoluteFill>
      <Background />

      <Series>
        {SCENES.map(({ C, d }, i) => (
          <Series.Sequence key={i} durationInFrames={d}>
            <C />
          </Series.Sequence>
        ))}
      </Series>

      <FlashOverlay />

      {HAS_NARRATION &&
        NARRATION.map((src, i) => (
          <Sequence key={src} from={starts[i]}>
            <Audio src={staticFile(src)} />
          </Sequence>
        ))}

      {HAS_MUSIC && (
        <Sequence from={30}>
          <Audio src={staticFile("audio/music/background.mp3")} volume={0.22} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
