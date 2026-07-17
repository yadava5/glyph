export type VisualState = 'raster' | 'simd' | 'hidden' | 'softmax' | 'benchmark';

export interface ScrollScene {
  id: VisualState;
  navLabel: string;
  heightVh: number;
  headline: string;
  body: string;
  visualState: VisualState;
  metric: {
    label: string;
    value: string;
    detail: string;
  };
  keyframes: {
    x: [number, number, number];
    y: [number, number, number];
    scale: [number, number, number];
    rotateX: [number, number, number];
    rotateY: [number, number, number];
    opacity: [number, number, number];
    filter: [string, string, string];
  };
}

export const forwardPassScenes: ScrollScene[] = [
  {
    id: 'raster',
    navLabel: 'Raster',
    heightVh: 92,
    headline: 'Rasterize the stroke into 784 input pixels.',
    body: 'The SVG stroke is downsampled into a 28x28 tensor with values in [0, 1], matching the native classifier input.',
    visualState: 'raster',
    metric: {
      label: 'Input',
      value: '28x28',
      detail: '784 normalized floats',
    },
    keyframes: {
      x: [-24, 0, 16],
      y: [26, 0, -18],
      scale: [0.92, 1, 0.96],
      rotateX: [9, 0, -6],
      rotateY: [-12, 0, 8],
      opacity: [0.56, 1, 0.74],
      filter: ['blur(4px)', 'blur(0px)', 'blur(1px)'],
    },
  },
  {
    id: 'simd',
    navLabel: 'SIMD',
    heightVh: 92,
    headline: 'SIMD compresses the dot-product hot loop.',
    body: 'The forward pass is still small, but each row benefits from hand-written AVX and NEON kernels where the target supports them.',
    visualState: 'simd',
    metric: {
      label: 'dot 256',
      value: '3.50x',
      detail: '4.835ms -> 1.380ms',
    },
    keyframes: {
      x: [32, 0, -22],
      y: [18, -4, -24],
      scale: [0.9, 1.04, 0.98],
      rotateX: [12, 2, -8],
      rotateY: [16, -2, -12],
      opacity: [0.5, 1, 0.78],
      filter: ['blur(5px)', 'blur(0px)', 'blur(1px)'],
    },
  },
  {
    id: 'hidden',
    navLabel: 'Hidden',
    heightVh: 92,
    headline: 'One hundred hidden units turn pixels into features.',
    body: 'The hidden layer is the compact feature workspace: violet activations rise, saturate, and feed the final logits.',
    visualState: 'hidden',
    metric: {
      label: 'Hidden layer',
      value: '100',
      detail: 'post-activation units',
    },
    keyframes: {
      x: [-18, 0, 24],
      y: [20, 0, -20],
      scale: [0.92, 1.02, 0.94],
      rotateX: [-8, 0, 7],
      rotateY: [-14, 2, 14],
      opacity: [0.56, 1, 0.76],
      filter: ['blur(4px)', 'blur(0px)', 'blur(1px)'],
    },
  },
  {
    id: 'softmax',
    navLabel: 'Outputs',
    heightVh: 92,
    headline: 'Ten sigmoid outputs become a ranked answer.',
    body: 'The winning output goes green only after the whole tensor path has completed. The workbench exposes the same scores live.',
    visualState: 'softmax',
    metric: {
      label: 'Outputs',
      value: '10',
      detail: 'argmax over sigmoid outputs',
    },
    keyframes: {
      x: [26, 0, -16],
      y: [18, -2, -16],
      scale: [0.9, 1.03, 0.98],
      rotateX: [10, 0, -7],
      rotateY: [14, -1, -10],
      opacity: [0.52, 1, 0.78],
      filter: ['blur(5px)', 'blur(0px)', 'blur(1px)'],
    },
  },
  {
    id: 'benchmark',
    navLabel: 'Benchmark',
    heightVh: 92,
    headline: 'The benchmark story stays honest about crossover.',
    body: 'OpenMP wins large matrix kernels but loses the tiny classify path. SIMD is the live-inference hero; OpenMP is a scale story.',
    visualState: 'benchmark',
    metric: {
      label: 'Classify',
      value: '81,628 img/s',
      detail: 'baseline beats openmp+native here',
    },
    keyframes: {
      x: [-20, 0, 18],
      y: [24, 0, -22],
      scale: [0.9, 1, 0.96],
      rotateX: [8, 0, -8],
      rotateY: [-16, 0, 12],
      opacity: [0.54, 1, 0.82],
      filter: ['blur(4px)', 'blur(0px)', 'blur(0px)'],
    },
  },
];
