import {
  type TrackingEvent,
  type EventDispatcher,
  type Tracker,
} from "@cluesive/core";

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
    void this.dispatcher(event).catch((error: unknown) => {
      console.error("Failed to dispatch click event:", error);
    });
  }

  private onClick(event: MouseEvent): void {
    const timestamp = Date.now();
    const element = event.target as HTMLElement;
    if (!element.hasAttribute(`data-cv-${this.name}`)) return;

    const trackId = element.getAttribute("data-cv-id");
    const universalContextAttribute = element.getAttribute("data-cv-context");
    const localContextAttr = element.getAttribute(
      `data-cv-${this.name}-context`,
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
        const parentContext = parent.getAttribute("data-cv-context");
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
