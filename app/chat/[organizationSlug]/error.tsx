"use client";

export default function ChatError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="public-chat-page">
      <div className="chat-card error-panel">
        <h1>Chat unavailable</h1>
        <p>We could not open the BuildPro assistant.</p>
        <button onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
