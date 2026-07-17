import { HiddenHeatmap } from './HiddenHeatmap';
import { SaliencyPanel } from './SaliencyPanel';
import { SoftmaxBars } from './SoftmaxBars';

export interface ActivationPanelsProps {
  prediction: number | null;
  confidence: number[];
  hiddenActivations?: number[];
  inputGrad?: number[];
}

/**
 * Three-panel activation visualization:
 *   1. Saliency   - 28x28 input_grad overlay (diverging colormap)
 *   2. Hidden     - N-unit post-activation heatmap (violet chroma-up)
 *   3. Confidence - 10 digit bars with a highlighted winner
 *
 * Each sub-panel falls back to a neutral display when its data is
 * absent (older servers, offline, first render before any prediction),
 * so this component is always safe to render.
 */
export function ActivationPanels({
  prediction,
  confidence,
  hiddenActivations,
  inputGrad,
}: ActivationPanelsProps) {
  return (
    <div className="activation-panels" aria-label="Activation visualization">
      <SaliencyPanel inputGrad={inputGrad} />
      <HiddenHeatmap hiddenActivations={hiddenActivations} />
      <div className="activation-panel">
        <span className="activation-panel-label">Confidence</span>
        <SoftmaxBars prediction={prediction} confidence={confidence} />
      </div>
    </div>
  );
}
