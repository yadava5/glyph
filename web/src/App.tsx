import { LazyMotion, MotionConfig } from 'motion/react';
import { CommandPalette } from './components/CommandPalette';
import { ScrollProgress } from './components/ScrollProgress';
import { LandingPage } from './features/landing/LandingPage';
import { motionTokens } from './features/experience/motionTokens';
import { useMnistDemoController } from './features/mnist/useMnistDemoController';

// Split the motion runtime out of the entry chunk (see lib/motionFeatures.ts).
// `strict` makes any straggling full-fat `motion.*` component throw in dev.
const loadMotionFeatures = () => import('./lib/motionFeatures').then((m) => m.default);

function App() {
  const controller = useMnistDemoController();

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig transition={motionTokens.pageSpring} reducedMotion="user">
        <div className="app-shell">
          <ScrollProgress />
          <LandingPage controller={controller} />
          <CommandPalette
            onClearCanvas={controller.handleClearCanvas}
            onLoadSampleDigit={controller.handleLoadSampleDigit}
            canClear={controller.canClear}
          />
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

export default App;
