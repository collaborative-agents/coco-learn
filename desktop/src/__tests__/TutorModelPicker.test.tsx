import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TutorModelPicker from '../renderer/components/chat/TutorModelPicker';
import { TUTOR_MODEL_PRESETS } from '../shared/model-catalog';

function setup(success = true) {
  const invoke = jest.fn(async (channel: string) =>
    channel === 'get-model-configuration'
      ? { tutors: TUTOR_MODEL_PRESETS }
      : { success, error: success ? undefined : 'Model unavailable' },
  );
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { invoke } },
  });
  return invoke;
}

it.each(TUTOR_MODEL_PRESETS)(
  'selects $model through the tutor service',
  async (model) => {
    const invoke = setup();
    const onChange = jest.fn();
    render(
      <TutorModelPicker modelId="" onChange={onChange} disabled={false} />,
    );
    const picker = screen.getByRole('combobox', { name: 'Tutor model' });
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.change(picker, { target: { value: model.id } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(model.id));
    expect(invoke).toHaveBeenCalledWith('set-chat-model', {
      modelId: model.id,
    });
  },
);

it('keeps the current model when switching fails', async () => {
  setup(false);
  const onChange = jest.fn();
  render(
    <TutorModelPicker
      modelId="gpt-5.6-sol"
      onChange={onChange}
      disabled={false}
    />,
  );
  const picker = screen.getByRole('combobox', { name: 'Tutor model' });
  await waitFor(() => expect(picker).toBeEnabled());
  fireEvent.change(picker, { target: { value: 'gpt-5.6-terra' } });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Model unavailable',
  );
  expect(onChange).not.toHaveBeenCalled();
  expect(picker).toHaveValue('gpt-5.6-sol');
});

it('disables model changes while a response is running', async () => {
  setup();
  render(
    <TutorModelPicker modelId="gpt-5.6-sol" onChange={jest.fn()} disabled />,
  );
  await screen.findByRole('option', { name: 'GPT-5.6 Sol' });
  expect(screen.getByRole('combobox', { name: 'Tutor model' })).toBeDisabled();
});
