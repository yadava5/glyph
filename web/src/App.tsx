import { MotionConfig } from 'motion/react';
import { CommandPalette } from './components/CommandPalette';
import { ScrollProgress } from './components/ScrollProgress';
import { LandingPage } from './features/landing/LandingPage';
import { motionTokens } from './features/experience/motionTokens';
import { useMnistDemoController } from './features/mnist/useMnistDemoController';

function App() {
  const controller = useMnistDemoController();

  return (
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
  );
}

export default App;
