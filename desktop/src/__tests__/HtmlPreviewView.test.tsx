import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import HtmlPreviewView from '../renderer/components/HtmlPreviewView';

it('opens a generic sandboxed HTML window, embeds Coco, and saves the page', async () => {
  const listeners = new Map<string, (payload: unknown) => void>();
  const sendMessage = jest.fn();
  const invoke = jest.fn(async (channel: string) => channel === 'get-coco-mascot-data-url'
    ? 'data:image/png;base64,YQ==' : { success: true });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { sendMessage, invoke, on: (channel: string, callback: (payload: unknown) => void) => {
      listeners.set(channel, callback);
      return () => listeners.delete(channel);
    } } },
  });
  render(<HtmlPreviewView />);
  expect(sendMessage).toHaveBeenCalledWith('html-preview-ready');
  act(() => listeners.get('html-preview')?.({ html: '<!doctype html><html><body><h1>My page</h1><img data-coco-mascot alt="Coco"><script>alert(1)</script></body></html>' }));
  const frame = screen.getByTitle('HTML page preview');
  await waitFor(() => expect(frame.getAttribute('srcdoc')).toContain('data:image/png;base64,YQ=='));
  expect(frame).toHaveAttribute('sandbox', '');
  expect(frame.getAttribute('srcdoc')).not.toContain('<script');
  fireEvent.click(screen.getByRole('button', { name: 'Save HTML' }));
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('save-html-preview', { html: expect.stringContaining('My page') }));
});
