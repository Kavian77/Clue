import { useEffect, useState } from 'react';
import { CoreTracker } from '@piq/core';
import { ClickTracker } from '@piq/click-tracker';

export function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  useEffect(() => {
    const tracker = CoreTracker.getInstance({
      debug: true,
      endpoint: 'https://api.example.com/events',
      batchSizeKB: 100, // Set a small batch size for demo purposes (100KB)
      globalContext: { app: 'demo' },
      headers: {
        'X-API-Key': 'demo-key'
      },
      middlewares: [
        // Add timestamp to all events
        (events) => events.map(event => ({
          ...event,
          context: {
            ...event.context,
            clientTimestamp: new Date().toISOString()
          }
        }))
      ],
      onSuccess: (events) => {
        console.log('✅ Successfully sent events:', events);
      },
      onError: (error, events) => {
        console.error('❌ Failed to send events:', error, events);
      }
    }).use(ClickTracker);
    
    tracker.start();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <header className="max-w-4xl mx-auto">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              data-track-id="menu-toggle"
              data-track-click="true"
              data-track-context='{"location":"header"}'
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
              data-track-id="primary-button"
              data-track-click="true"
              data-track-context='{"type":"primary"}'
            >
              Click Me
            </button>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Secondary Button</h2>
            <button
              className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg transition-colors w-full"
              data-track-id="secondary-button"
              data-track-click="true"
              data-track-context='{"type":"secondary"}'
            >
              Another Action
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}