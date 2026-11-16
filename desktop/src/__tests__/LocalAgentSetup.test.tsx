import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useModelSetup from '../renderer/components/onboarding/useModelSetup';
import ModelsStep from '../renderer/components/onboarding/ModelsStep';
import localAgentModel from '../shared/local-agent-model';

function Setup() {
  const setup = useModelSetup(false, true);
  return (
    <>
      <ModelsStep {...setup.modelProps} />
      <button onClick={setup.saveModels}>Save</button>
    </>
  );
}

it('prefills one model for local chat and observation with a single key', async () => {
  const invoke = jest.fn(async (channel: string) => {
    if (channel === 'save-model-configuration') return { success: true };
    if (channel === 'test-model-connection')
      return { success: true, message: 'Connected.' };
    return null;
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { invoke } },
  });
  render(<Setup />);
  expect(screen.queryByText('Sensitive sensing model')).toBeNull();
  expect(screen.getByText(/When Coco is awake, screenshots are sent to this model/)).toBeInTheDocument();
  expect(screen.getByDisplayValue(localAgentModel.model)).toBeInTheDocument();
  expect(screen.getByDisplayValue(localAgentModel.baseUrl)).toBeInTheDocument();
  const key = screen.getByPlaceholderText('API key');
  expect(key).toHaveAttribute('type', 'password');
  fireEvent.change(key, { target: { value: 'test-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
  await screen.findByText('Connected.');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      'save-model-configuration',
      expect.objectContaining({
        defaultTutorId: localAgentModel.id,
        credentials: { 'tutor:nv_inference': 'test-key' },
        tutors: [localAgentModel],
      }),
    ),
  );
});
