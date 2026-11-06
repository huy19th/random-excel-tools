import { useEffect, useState } from 'preact/hooks';
import { Home } from './pages/Home';
import { MergePage } from './pages/MergePage';
import { SplitPage } from './pages/SplitPage';

// Hash routing: GitHub Pages has no server-side rewrites, so /merge would 404 on reload.
const routes: Record<string, () => preact.JSX.Element> = {
  '': Home,
  merge: MergePage,
  split: SplitPage,
};

function currentRoute() {
  return location.hash.replace(/^#\/?/, '');
}

export function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);

  const Page = routes[route] ?? Home;
  return (
    <>
      <header class="container">
        <nav>
          <ul>
            <li><a href="#/"><strong>Excel Tools</strong></a></li>
          </ul>
          <ul>
            <li><a href="#/merge" aria-current={route === 'merge' ? 'page' : undefined}>Merge</a></li>
            <li><a href="#/split" aria-current={route === 'split' ? 'page' : undefined}>Split</a></li>
          </ul>
        </nav>
      </header>
      <main class="container">
        <Page />
      </main>
      <footer class="container">
        <small>Files are processed entirely in your browser and never uploaded to any server.</small>
      </footer>
    </>
  );
}
