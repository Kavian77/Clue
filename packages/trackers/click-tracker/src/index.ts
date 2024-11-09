import {
  type TrackingEvent,
  type EventDispatcher,
  type Tracker,
} from "@piq/core";

export class ClickTracker implements Tracker {
  public readonly name: string;
  private dispatcher: EventDispatcher;
  private handleClick: (event: MouseEvent) => void;

  constructor({
    dispatcher,
    name,
  }: {
    dispatcher: EventDispatcher;
    name?: string;
  }) {
    this.name = name || "click";
    this.dispatcher = dispatcher;
    this.handleClick = this.onClick.bind(this);
  }

  public start(): void {
    document.addEventListener("click", this.handleClick, true);
  }

  public stop(): void {
    document.removeEventListener("click", this.handleClick, true);
  }

  private track(event: TrackingEvent): void {
    void this.dispatcher(event).catch((error) => {
      console.error("Failed to dispatch click event:", error);
    });
  }

  private onClick(event: MouseEvent): void {
    const timestamp = Date.now();
    const element = event.target as HTMLElement;
    if (!element.hasAttribute(`data-piq-${this.name}`)) return;

    const trackId = element.getAttribute("data-piq-id");
    const universalContextAttribute = element.getAttribute("data-piq-context");
    const localContextAttr = element.getAttribute(
      `data-piq-${this.name}-context`
    );
    let context: Record<string, unknown> = {};

    try {
      if (localContextAttr) {
        context = JSON.parse(localContextAttr);
      }
      if (universalContextAttribute) {
        context = { ...JSON.parse(universalContextAttribute), ...context };
      }

      let parent = element.parentElement;
      while (parent) {
        const parentContext = parent.getAttribute("data-piq-context");
        if (parentContext) {
          context = { ...JSON.parse(parentContext), ...context };
        }
        parent = parent.parentElement;
      }
    } catch (e) {
      console.error("Failed to parse tracking context:", e);
    }

    this.track({
      id: trackId ?? crypto.randomUUID(),
      type: this.name,
      timestamp,
      context,
    });
  }
}
