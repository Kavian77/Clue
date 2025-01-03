# 🎯 Cluesive

A **lightweight**, **type-safe**, **fault-tolerant** event tracking library for modern web applications. Cluesive Core delivers essential tracking functionality with a modular, plugin-based architecture, making it ideal for high-performance applications while minimizing bundle size.

[![npm version](https://img.shields.io/npm/v/@cluesive/core.svg)](https://www.npmjs.com/package/@cluesive/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@cluesive/core)](https://bundlephobia.com/package/@cluesive/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org)

---

## ✨ Key Features

- 🛡️ **Type-Safe & Reliable**: Written in TypeScript for robust typing and error resilience.
- 🔌 **Modular Plugin System**: Include only the tracking plugins you need, keeping bundles lean.
- 🌐 **Offline Resilience**: Automatically queues events while offline and syncs when online.
- 📦 **Smart Batching**: Efficiently batches events to optimize network usage.
- 🛠️ **Fault Tolerance**: Retries failed events with exponential backoff, ensuring reliable data delivery.
- 🎨 **Framework Agnostic**: Integrates seamlessly with any JavaScript framework.
- 🔧 **Middleware Support**: Transform, enrich, or validate events before sending.
- 🔄 **Automatic Context Inheritance**: Captures contextual data from nested elements up the DOM.
- 🚀 **Performance Optimized**: Designed for high-performance applications.

---

## 📖 Features Explained

### 🔄 Automatic Context Inheritance

Cluesive Core’s **Automatic Context Inheritance** feature simplifies event tracking by automatically gathering contextual data from parent elements up the DOM hierarchy. This provides fully contextualized events without redundant declarations and is ideal for applications with complex or deeply nested components.

**Benefits**:

- 📉 **Reduces Redundancy**: Define context once, and all nested elements inherit it automatically.
- ⚡ **Optimizes Performance**: Fewer attributes in each event listener reduce memory and processing overhead.
- 🔗 **Handles Dynamic Contexts**: Automatically updates context when elements are added or changed in dynamic interfaces.

### 🔄 Smart Retry Logic

To ensure fault tolerance, Cluesive Core automatically retries failed event transmissions using exponential backoff. This feature ensures data reliability even under network instability.

**Retry Logic**:

- **Exponential Backoff**: Increases delay time with each retry attempt, reducing network strain.
- **Configurable Parameters**: Adjust retry attempts and initial delay to balance between responsiveness and load.

**Example Retry Sequence**:

1. `retryDelay` (initial delay)
2. `retryDelay * 2` (second attempt)
3. `retryDelay * 3` (third attempt)
4. ...up to `retryAttempts`

### 🌐 Offline Support

Cluesive Core includes built-in offline support, queuing events when users are offline and automatically syncing them upon reconnection. This feature is essential for applications with users on unstable networks, ensuring no data loss during offline periods.

### 📦 Smart Batching

With smart batching, Cluesive Core efficiently groups events to reduce the number of network requests, minimizing the impact on bandwidth and enhancing performance. Batching parameters like `syncingInterval` and `maxBatchSizeInKB` can be configured to adjust the frequency and size of batches, striking a balance between real-time data and network load.

### 🔧 Middleware Support

Cluesive Core enables you to add custom middleware functions that can transform, enrich, or validate events before they are sent. Middleware functions can be used to:

- Append additional context (e.g., environment, viewport size)
- Filter out sensitive data
- Format or validate events for specific endpoints

### 🚀 Lightweight

Cluesive Core is optimized for performance with the minimal dependencies, making it highly suitable for resource-conscious applications. Its modular design means you can include only the plugins you need, further keeping your bundle size minimal.

---

## 📦 Installation

To install Cluesive Core, use the following command:

```bash
npm install @cluesive/core
```

---

## 🚀 Quick Start

Here’s a quick guide to setting up Cluesive Core and starting event tracking with context inheritance:

```typescript
import { CoreTracker } from "@cluesive/core";
import { ClickTracker } from "@cluesive/click-tracker";

// Initialize the tracker
const tracker = CoreTracker.getInstance({
  endpoint: "https://api.example.com/events",
  headers: {
    "X-API-Key": "your-api-key",
  },
  middlewares: [
    (events) =>
      events.map((event) => ({
        ...event,
        context: {
          ...event.context,
          userAgent: navigator.userAgent,
        },
      })),
  ],
  onSuccess: (events) => {
    console.log("✅ Events sent successfully:", events);
  },
  onError: (error, events) => {
    console.error("❌ Failed to send events:", error);
  },
}).use(ClickTracker);

// Start tracking
tracker.start();
```

---

## 🎯 Examples

### Example 1: Click Tracking with Context Inheritance

In this example, context attributes are defined at various levels, such as app-level, section-level, and action-specific contexts. Cluesive Core automatically collects and combines these attributes so that each event has full context.

```html
<!-- App Shell: Global context for all events -->
<div data-cv-context='{"app":"myapp","version":"1.0.0"}'>
  <!-- Navigation Section -->
  <nav data-cv-context='{"section":"navigation"}'>
    <button
      data-cv-click="true"
      data-cv-id="menu-toggle"
      data-cv-context='{"action":"toggle-menu"}'
    >
      Menu
    </button>
  </nav>

  <!-- Main Content with Nested Contexts -->
  <main data-cv-context='{"section":"content"}'>
    <!-- Product Section -->
    <section
      data-cv-context='{"subsection":"products","category":"electronics"}'
    >
      <div data-cv-context='{"product":"laptop","price":999}'>
        <button
          data-cv-click="true"
          data-cv-id="add-to-cart"
          data-cv-context='{"action":"add-to-cart"}'
        >
          Add to Cart
        </button>
      </div>
    </section>
  </main>
</div>
```

#### Resulting Event Context

When the "Add to Cart" button is clicked, the resulting context automatically includes all relevant details from each level:

```javascript
{
  "app": "myapp",
  "version": "1.0.0",
  "section": "content",
  "subsection": "products",
  "category": "electronics",
  "product": "laptop",
  "price": 999,
  "action": "add-to-cart"
}
```

### Example 2: Custom Middleware for Event Enrichment

Add custom data to events using middleware. Here’s an example that adds viewport size and environment info:

```typescript
CoreTracker.getInstance({
  endpoint: "https://api.example.com/events",
  middlewares: [
    (events) =>
      events.map((e) => ({
        ...e,
        context: {
          ...e.context,
          env: process.env.NODE_ENV,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        },
      })),
  ],
});
```

### Example 3: Configuring Event Retry and Batching

Fine-tune control over retry logic and batching to optimize for responsiveness or reduce network load:

```typescript
CoreTracker.getInstance({
  endpoint: "https://api.example.com/events",
  syncingInterval: 3000, // Send events every 3 seconds
  maxBatchSizeInKB: 250, // Trigger send when batch reaches 250 KB
  retryAttempts: 5, // Retry up to 5 times on failure
  retryDelay: 500, // Start retries with a 500 ms delay
});
```

### Example 4: Handling Success and Error Callbacks

Customize event processing on successful send or failure. This is useful for logging, user notifications, or analytics dashboards:

```typescript
CoreTracker.getInstance({
  endpoint: "https://api.example.com/events",
  onSuccess: (events) => {
    console.log("✅ Events successfully sent:", events);
    updateDashboard(events);
  },
  onError: (error, events) => {
    console.error("❌ Failed to send events:", error);
    reportToErrorTracking(error);
  },
});
```

---

## 📋 API Reference

| Option             | Type                     | Default  | Description                                   |
| ------------------ | ------------------------ | -------- | --------------------------------------------- |
| `endpoint`         | `string`                 | -        | **Required**. URL for sending events.         |
| `headers`          | `Record<string, string>` | `{}`     | Optional custom headers.                      |
| `method`           | `'POST'｜'PUT'`          | `'POST'` | HTTP method for requests.                     |
| `syncingInterval`  | `number`                 | `5000`   | Time (ms) between batch sends.                |
| `maxBatchSizeInKB` | `number｜'disabled'`     | `500`    | Maximum batch size in KB.                     |
| `retryAttempts`    | `number`                 | `3`      | Retry attempts for failed requests.           |
| `retryDelay`       | `number`                 | `1000`   | Base delay in ms between retries.             |
| `middlewares`      | `EventMiddleware[]`      | `[]`     | Functions to transform events before sending. |
| `onSuccess`        | `SuccessHandler`         | -        | Callback on successful send.                  |
| `onError`          | `ErrorHandler`           | -        | Callback on failed send.                      |
| `debug`            | `boolean`                | `false`  | Enables debug logging.                        |

---

## 🔌 Available Plugins

- [@cluesive/click-tracker](https://www.npmjs.com/package/@cluesive/click-tracker): Easily track click events.
- More plugins are on the way!

---

## 📝 License

MIT © Cluesive
