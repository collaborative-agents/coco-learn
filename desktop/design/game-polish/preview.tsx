import { createRoot } from 'react-dom/client';
import '../../src/renderer/theme/tokens.css';
import '../../src/renderer/theme/controls.css';
import '../../src/renderer/App.css';
import ObservationBubble from '../../src/renderer/components/ObservationBubble';
import coco from '../../assets/wait1.png';
import GamePage from './GamePage';

declare global {
  interface Window {
    __cocoDesign: { title: string; timeOfDay: string; html: string; updated?: boolean; gameOver?: boolean };
  }
}
const preview = window.__cocoDesign;
createRoot(document.getElementById('root')!).render(
  <GamePage {...preview} companion={<>
    <ObservationBubble bubble={{
      status: 'observing', fadingOut: false, guide: { label: 'COCO' },
      phrase: preview.updated
        ? 'I gave your world a little sunshine. Take a look, then tell me what you think!'
        : "Play the game, then let’s make it your own! Click the ‘Make it yours’ button.",
    }} />
    <img src={coco} alt="Coco fox avatar" draggable={false} />
  </>} />,
);
