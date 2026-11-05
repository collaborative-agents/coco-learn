import subscribeCocoSleepMode from './coco-sleep-mode';

let listener: (value: unknown) => void;
const invoke = jest.fn();
const remove = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  invoke.mockReset();
  remove.mockReset();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        invoke,
        on: (_channel: string, handler: typeof listener) => {
          listener = handler;
          return remove;
        },
      },
    },
  });
});
afterEach(() => jest.useRealTimers());

test('a delayed sleeping snapshot cannot overwrite a newer wake event', async () => {
  let complete!: (value: { sleeping: boolean }) => void;
  invoke.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const changed = jest.fn();
  const dispose = subscribeCocoSleepMode(changed);
  listener({ sleeping: false });
  complete({ sleeping: true });
  await Promise.resolve();
  expect(changed.mock.calls).toEqual([[false]]);
  dispose();
});

test('recovers from a missed wake event even while the UI thinks Coco is asleep', async () => {
  invoke
    .mockResolvedValueOnce({ sleeping: true })
    .mockResolvedValue({ sleeping: false });
  const changed = jest.fn();
  const dispose = subscribeCocoSleepMode(changed);
  await Promise.resolve();
  expect(changed).toHaveBeenLastCalledWith(true);
  jest.advanceTimersByTime(30000);
  await Promise.resolve();
  expect(changed).toHaveBeenLastCalledWith(false);
  dispose();
  jest.advanceTimersByTime(30000);
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledTimes(1);
});

test('ignores pending reads after the window unmounts', async () => {
  let complete!: (value: { sleeping: boolean }) => void;
  invoke.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const changed = jest.fn();
  const dispose = subscribeCocoSleepMode(changed);
  dispose();
  complete({ sleeping: true });
  await Promise.resolve();
  expect(changed).not.toHaveBeenCalled();
});

test('reports denied access separately without putting Coco to sleep', async () => {
  invoke.mockResolvedValue({ sleeping: false, tutoringAllowed: true });
  const sleeping = jest.fn();
  const access = jest.fn();
  const dispose = subscribeCocoSleepMode(sleeping, access);
  await Promise.resolve();
  expect(access).toHaveBeenLastCalledWith(true);
  listener({ sleeping: false, tutoringAllowed: false });
  expect(sleeping).toHaveBeenLastCalledWith(false);
  expect(access).toHaveBeenLastCalledWith(false);
  listener({ sleeping: true, tutoringAllowed: true });
  expect(sleeping).toHaveBeenLastCalledWith(true);
  expect(access).toHaveBeenLastCalledWith(true);
  dispose();
});
