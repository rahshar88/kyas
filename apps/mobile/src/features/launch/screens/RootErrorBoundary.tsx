import { Component, type ErrorInfo, type ReactNode } from 'react';

import { recordFatal } from '@/services/crash-log';

import { LastCrashScreen } from './LastCrashScreen';

interface State {
  crash: { message: string; stack: string | undefined; at: string } | null;
}

/**
 * Catches a render error anywhere below it and shows what happened.
 *
 * Without this, an exception thrown while rendering any screen unwinds past the root and the
 * process ends. On a phone that is indistinguishable from every other kind of crash: the app
 * opens and shuts, and a tester has nothing to report but that sentence.
 *
 * That is not hypothetical. `Intl.Segmenter` — present in Node, absent in Hermes — was called
 * while drawing a profile initial. Every unit test passed, and the app died on launch the
 * first time an account had a name.
 *
 * A class component because that is still the only way to implement `componentDidCatch`.
 *
 * **What it cannot catch**, and the reason `crash-log` exists too: an error thrown while
 * modules are evaluated, or before this mounts. Those never reach a boundary, so the global
 * handler records them and the next launch shows them instead.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { crash: null };

  static getDerivedStateFromError(error: unknown): State {
    const asError = error instanceof Error ? error : new Error(String(error));
    return {
      crash: {
        message: `${asError.name}: ${asError.message}`,
        stack: asError.stack,
        at: 'while drawing the screen',
      },
    };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Persisted as well as rendered: if showing this screen somehow fails too, the next
    // launch still has it. Scrubbing happens inside recordFatal.
    recordFatal(error, `while drawing the screen${info.componentStack ? '' : ''}`);
  }

  override render(): ReactNode {
    const { crash } = this.state;

    if (crash !== null) {
      return (
        <LastCrashScreen
          crash={crash}
          // Retrying the same render usually fails the same way; what a person wants is to be
          // able to get past the message, so this clears it and lets the tree remount.
          onDismiss={() => this.setState({ crash: null })}
        />
      );
    }

    return this.props.children;
  }
}
