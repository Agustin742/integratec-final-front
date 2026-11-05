import { messages } from './messages';

export function App() {
  return (
    <main>
      <h1>{messages.title}</h1>
      <p>{messages.bootstrapReady}</p>
    </main>
  );
}
