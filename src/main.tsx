import { render } from 'preact';
import { App } from './App';
import './styles/theme.css';
import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true
});

const container = document.getElementById('app');
if (container) {
  render(<App />, container);
}
