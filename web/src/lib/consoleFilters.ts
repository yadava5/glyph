const suppressedWarnings = [
  /^THREE\.Clock: This module has been deprecated\. Please use THREE\.Timer instead\.$/,
];

export function installConsoleFilters() {
  const originalWarn = console.warn.bind(console);

  console.warn = (...args: unknown[]) => {
    const message = args.map(String).join(' ');
    if (suppressedWarnings.some((pattern) => pattern.test(message))) {
      return;
    }
    originalWarn(...args);
  };
}
