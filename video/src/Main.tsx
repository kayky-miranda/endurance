import { AbsoluteFill, Sequence, Series, Audio, staticFile } from "remotion";
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
import { SCENE_FRAMES } from "./theme";

/**
 * Áudio plugável: se os MP3s existirem em public/audio/, são tocados; senão,
 * o vídeo renderiza em silêncio. Controlado pela flag abaixo — ligue depois
 * de gerar os áudios do ElevenLabs (ver README).
 */
const HAS_NARRATION = false;
const HAS_MUSIC = false;

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

export const Main: React.FC = () => {
  // Calcula o frame de início de cada cena para casar a narração.
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

      {/* Narração — um clip por cena, alinhado ao início da cena. */}
      {HAS_NARRATION &&
        NARRATION.map((src, i) => (
          <Sequence key={src} from={starts[i]}>
            <Audio src={staticFile(src)} />
          </Sequence>
        ))}

      {/* Música de fundo — começa no frame 45, volume baixo. */}
      {HAS_MUSIC && (
        <Sequence from={45}>
          <Audio src={staticFile("audio/music/background.mp3")} volume={0.15} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
