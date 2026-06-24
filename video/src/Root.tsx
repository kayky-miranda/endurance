import { Composition } from "remotion";
import { Main } from "./Main";
import { MainVertical } from "./MainVertical";
import { VIDEO, TOTAL_FRAMES } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EnduranceIntro"
        component={Main}
        durationInFrames={TOTAL_FRAMES}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="EnduranceIntroVertical"
        component={MainVertical}
        durationInFrames={TOTAL_FRAMES}
        fps={VIDEO.fps}
        width={1080}
        height={1920}
      />
    </>
  );
};
