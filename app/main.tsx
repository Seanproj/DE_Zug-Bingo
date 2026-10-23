import { render } from 'preact';
import './styles.css';
import { openStore } from './storage/db.ts';
import { App } from './ui/App.tsx';

const store = await openStore();
const settings = await store.getSettings();
render(<App store={store} initialSettings={settings} />, document.getElementById('app')!);
