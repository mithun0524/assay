import { Composition } from 'remotion';
import { Promo, FPS, DURATION } from './Promo';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Promo"
    component={Promo}
    durationInFrames={DURATION}
    fps={FPS}
    width={1280}
    height={800}
  />
);
