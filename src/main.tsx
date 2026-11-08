import { render } from 'preact';

export function App() {
  return (
    <div id="nusuk-app">
      <h1>Nusuk Photo</h1>
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}
