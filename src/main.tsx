import { render } from 'preact';
import '@picocss/pico/css/pico.min.css';
import './style.css';
import { App } from './App';

render(<App />, document.getElementById('app')!);
