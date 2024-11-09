import { useEffect, useState } from "react";
import { Piq } from "@piq/core";
import { ClickTracker } from "@piq/click-tracker";

export function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const tracker = Piq.init({
      debug: true,
      endpoint: "https://api.example.com/events",
      maxBatchSizeInKB: 100,
      globalContext: { app: "demo", sessionId: "12345" },
      headers: {
        "X-API-Key": "demo-key",
      },
      middlewares: [
        // Add a unique ID to each event
        (events) =>
          events.map((event) => ({
            ...event,
            context: {
              ...event.context,
              id: Math.random().toString(36).substring(7),
            },
          })),
      ],
      onSuccess: (events) => {
        console.log("✅ Successfully sent events:", events);
      },
      onError: (error, events) => {
        console.error("❌ Failed to send events:", error, events);
      },
    }).use(ClickTracker);

    tracker.start();

    return () => {
      tracker.stop();
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8"
      data-piq-context={JSON.stringify({
        pageName: "Home",
      })}
    >
      <header className="max-w-4xl mx-auto">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              data-piq-id="menu-toggle"
              data-piq-click
              data-piq-context='{"location":"header"}'
            >
              Hamburger Menu
            </button>
            <h1 className="text-2xl font-bold">PIQ Demo</h1>
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto mt-12">
        <section className="grid gap-8 md:grid-cols-2">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Primary Button</h2>
            <button
              className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-lg transition-colors w-full"
              data-piq-id="primary-button"
              data-piq-click
              data-piq-click-context={JSON.stringify({
                "click-context":
                  "This context will be attached all click events triggered by this button",
              })}
              data-piq-context={JSON.stringify({
                "universal-context":
                  "This context will be attached to all events triggered either by this button or its children",
              })}
            >
              Click Me
            </button>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Secondary Button</h2>
            <button
              className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg transition-colors w-full"
              data-piq-id="secondary-button"
              data-piq-click
              data-piq-context={JSON.stringify({
                "universal-context":
                  "This context will be attached to all events triggered either by this button or its children",
              })}
            >
              Another Action
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
