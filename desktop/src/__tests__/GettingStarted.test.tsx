import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GettingStarted from '../renderer/components/getting-started/GettingStarted';
import {
  extractPreviewHtml,
  embedCocoMascot,
} from '../renderer/components/chat/html-preview';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({ matches: false })),
  });
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({
      fillRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
    } as unknown as CanvasRenderingContext2D);
});
afterEach(() => jest.restoreAllMocks());

it('opens the native game directly from Start Task without an embedded setup page', async () => {
  const start = jest.fn(), invoke = jest.fn(async () => ({state:{phase:'play'}}));
  (window as any).electron = {ipcRenderer:{invoke,on:()=>()=>{}}};
  render(<GettingStarted onStart={start} />);
  fireEvent.click(screen.getByRole('button', {name:'Start Task'}));
  await waitFor(()=>expect(start).toHaveBeenCalled());
  expect(invoke).toHaveBeenCalledWith('runner-start');
  expect(screen.queryByTitle('Your playable game')).toBeNull();
});

it('shows the actual native-window startup error and allows retry', async () => {
  (window as any).electron = {ipcRenderer:{invoke:jest.fn().mockResolvedValue({error:'Game window could not open.'})}};
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button',{name:'Start Task'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Game window could not open.'));
  expect(screen.getByRole('button',{name:'Start Task'})).not.toBeNull();
});

it('previews any complete HTML page and removes executable content', () => {
  const html = extractPreviewHtml(
    '```html\n<!doctype html><html><head><style>body{color:blue}</style></head><body><section>A</section><script>alert(1)</script><a href="https://example.com" onclick="alert(1)">link</a><img data-coco-mascot alt="Coco"></body></html>\n```',
  );
  expect(html).toContain('<section>A</section>');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('onclick');
  expect(html).not.toContain('href=');
  expect(
    extractPreviewHtml('<html><body><section>Only one</section></body></html>'),
  ).toContain('Only one');
  expect(extractPreviewHtml('<p>Not a full page</p>')).toBeNull();
  expect(embedCocoMascot(html!, 'data:image/png;base64,YQ==')).toContain(
    'src="data:image/png;base64,YQ=="',
  );
});

it('crosses off a completed task and keeps it completed on remount', async () => {
  const invoke = jest.fn(async () => ({complete:true}));
  (window as any).electron = {ipcRenderer:{invoke,on:()=>()=>{}}};
  const first = render(<GettingStarted />);
  await screen.findByText('Completed');
  expect(screen.getByRole('heading', {name:/Play with Coco/}).querySelector('s')).not.toBeNull();
  expect(screen.getByRole('button', {name:'Play again'})).not.toBeNull();
  expect(invoke).not.toHaveBeenCalledWith('runner-start');
  first.unmount();
  render(<GettingStarted />);
  await screen.findByText('Completed');
});
it('updates the task checkmark when the game completion event arrives', async () => {
  let complete = false;
  let changed: () => void = () => {};
  (window as any).electron = {ipcRenderer:{
    invoke:jest.fn(async () => ({complete})),
    on:(_channel:string, listener:()=>void)=>{changed=listener;return ()=>{}},
  }};
  render(<GettingStarted />);
  expect(screen.queryByText('Completed')).toBeNull();
  complete=true;
  changed();
  await screen.findByText('Completed');
});
