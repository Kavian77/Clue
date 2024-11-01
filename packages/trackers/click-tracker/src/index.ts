import {
  type TrackerOptions,
  type TrackingEvent,
  type Tracker,
} from '@piq/core';

export class ClickTracker implements Tracker {
  public readonly type = 'click';
  private options: TrackerOptions;
  private handleClick: (event: MouseEvent) => void;

  constructor(options: TrackerOptions) {
    this.options = options;
    this.handleClick = this.onClick.bind(this);
  }

  public start(): void {
    document.addEventListener('click', this.handleClick, true);
  }

  public stop(): void {
    document.removeEventListener('click', this.handleClick, true);
  }

  public track(event: TrackingEvent): void {
    if (this.options.onBatchDispatch) {
      void this.options.onBatchDispatch([event]).catch((error) => {
        console.error('Failed to dispatch click event:', error);
      });
    }
  }

  private onClick(event: MouseEvent): void {
    const element = event.target as HTMLElement;
    if (!element.hasAttribute('data-track-click')) return;

    const trackId = element.getAttribute('data-track-id');
    const contextAttr = element.getAttribute('data-track-context');
    let context: Record<string, unknown> = {};

    try {
      if (contextAttr) {
        context = JSON.parse(contextAttr);
      }
      let parent = element.parentElement;
      while (parent) {
        const parentContext = parent.getAttribute('data-track-context');
        if (parentContext) {
          context = { ...JSON.parse(parentContext), ...context };
        }
        parent = parent.parentElement;
      }
    } catch (e) {
      console.error('Failed to parse tracking context:', e);
    }

    this.track({
      id: trackId ?? crypto.randomUUID(),
      type: this.type,
      timestamp: Date.now(),
      context,
      element: {
        tag: element.tagName.toLowerCase(),
        attributes: Object.fromEntries(
          Array.from(element.attributes).map((attr) => [attr.name, attr.value])
        ),
      },
    });
  }
}
