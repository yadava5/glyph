import { Command } from 'cmdk';
import {
  Brush,
  CornerDownLeft,
  GitPullRequest,
  Gauge,
  RotateCcw,
  Search,
  Server,
  Sparkles,
  Target,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface CommandPaletteProps {
  onClearCanvas: () => void;
  onLoadSampleDigit: () => void;
  canClear: boolean;
}

interface CommandAction {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  keywords: string[];
  disabled?: boolean;
  run: () => void;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

export function CommandPalette({
  onClearCanvas,
  onLoadSampleDigit,
  canClear,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    setOpen((o) => !o);
  });
  useHotkeys('escape', () => setOpen(false), { enableOnFormTags: true });

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const runAndClose = (action: () => void) => {
    action();
    setOpen(false);
  };

  const actions: CommandAction[] = [
    {
      id: 'sample',
      label: 'Load sample digit',
      detail: 'Draws a 5 and runs inference',
      icon: Sparkles,
      keywords: ['demo', 'sample', 'digit', 'predict'],
      run: () => onLoadSampleDigit(),
    },
    {
      id: 'classifier',
      label: 'Go to live bench',
      detail: 'Jump to the wasm workbench',
      icon: Brush,
      keywords: ['draw', 'canvas', 'classify', 'bench', 'workbench'],
      run: () => scrollToSection('classifier'),
    },
    {
      id: 'results',
      label: 'Go to prediction panels',
      detail: 'Jump to confidence and activations',
      icon: Target,
      keywords: ['result', 'prediction', 'activation', 'softmax'],
      run: () => scrollToSection('results'),
    },
    {
      id: 'problem',
      label: 'Go to the problem',
      detail: 'Jump to the idle-lanes act',
      icon: Zap,
      keywords: ['problem', 'scalar', 'lanes', 'idle'],
      run: () => scrollToSection('problem'),
    },
    {
      id: 'solution',
      label: 'Go to the solution',
      detail: 'Jump to the hand-written kernel',
      icon: Workflow,
      keywords: ['solution', 'kernel', 'simd', 'intrinsics', 'avx'],
      run: () => scrollToSection('solution'),
    },
    {
      id: 'build',
      label: 'Go to the instruction sets',
      detail: 'Jump to the ISA ladder and runtimes',
      icon: Server,
      keywords: ['build', 'isa', 'wasm', 'native', 'runtime', 'fallback'],
      run: () => scrollToSection('build'),
    },
    {
      id: 'proof',
      label: 'Go to the proof',
      detail: 'Jump to benchmarks and reproducibility',
      icon: Gauge,
      keywords: ['proof', 'benchmark', 'performance', 'openmp', 'reproduce', 'evidence'],
      run: () => scrollToSection('proof'),
    },
    {
      id: 'clear',
      label: 'Clear canvas',
      detail: 'Reset drawing and prediction',
      icon: RotateCcw,
      keywords: ['clear', 'reset'],
      disabled: !canClear,
      run: () => onClearCanvas(),
    },
    {
      id: 'repo',
      label: 'Open repo on GitHub',
      detail: 'View source code',
      icon: GitPullRequest,
      keywords: ['github', 'repo', 'source'],
      run: () => {
        window.open('https://github.com/yadava5/fast-mnist-nn', '_blank', 'noopener');
      },
    },
    {
      id: 'close',
      label: 'Close palette',
      detail: 'Return to the demo',
      icon: X,
      keywords: ['escape', 'close'],
      run: () => undefined,
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="command-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.14 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <motion.div
            className="command-shell"
            layout
            initial={reduced ? false : { opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
            transition={
              reduced ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 32, mass: 0.8 }
            }
          >
            <LayoutGroup>
              <Command className="command-panel">
                <div className="command-search-row">
                  <Search className="command-search-icon" size={18} strokeWidth={1.8} aria-hidden />
                  <Command.Input placeholder="Type a command..." className="command-input" />
                  <span className="command-shortcut">Esc</span>
                </div>
                <Command.List className="command-list">
                  <Command.Empty className="command-empty">No results.</Command.Empty>
                  <Command.Group heading="Actions">
                    {actions.map((action, index) => {
                      const Icon = action.icon;
                      return (
                        <Command.Item
                          key={action.id}
                          value={action.label}
                          keywords={action.keywords}
                          disabled={action.disabled}
                          onSelect={() => runAndClose(action.run)}
                          className="command-item"
                        >
                          <motion.span
                            className="command-item-motion"
                            layout
                            initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={
                              reduced
                                ? { duration: 0 }
                                : {
                                    type: 'spring',
                                    stiffness: 420,
                                    damping: 34,
                                    mass: 0.75,
                                    delay: index * 0.018,
                                  }
                            }
                          >
                            <span className="command-icon" aria-hidden>
                              <Icon size={17} strokeWidth={2} />
                            </span>
                            <span className="command-copy">
                              <span className="command-label">{action.label}</span>
                              <span className="command-detail">{action.detail}</span>
                            </span>
                            <span className="command-enter" aria-hidden>
                              <CornerDownLeft size={14} strokeWidth={1.8} />
                            </span>
                          </motion.span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                </Command.List>
              </Command>
            </LayoutGroup>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
