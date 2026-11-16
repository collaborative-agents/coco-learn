/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import localAgentModel from '../shared/local-agent-model';
import {
  saveModelConfiguration,
  prepareModelConnectionTest,
  resolveModelRuntime,
} from './model-config-store';

let mockDirectory: string;
jest.mock('electron', () => ({ app: { getPath: () => mockDirectory } }));

const input = {
  sensing: { ...localAgentModel, id: 'sensing' },
  tutors: [localAgentModel],
  defaultTutorId: localAgentModel.id,
  credentials: { 'tutor:nv_inference': 'test-nvidia-key' },
};
const originalEnv = process.env;
beforeEach(() => {
  mockDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-model-test-'));
  process.env = {
    ...originalEnv,
    LLM_ROUTER_URL: '',
    NV_INFERENCE_API_KEY: '',
  };
});
afterEach(() => {
  process.env = originalEnv;
  fs.rmSync(mockDirectory, { recursive: true, force: true });
});

it('saves a tutor-only key and restores the NVIDIA route without exposing the key to the renderer or sensing', () => {
  const view = saveModelConfiguration(input, { sensingEnabled: false });
  expect(JSON.stringify(view)).not.toContain('test-nvidia-key');
  expect(view.credentialStatus['tutor:nv_inference']).toBe(true);
  const runtime = resolveModelRuntime()!;
  expect(runtime.config.tutors[0].model).toBe(
    `nv_inference/${localAgentModel.model}`,
  );
  expect(runtime.tutorEnv).toEqual({
    NV_INFERENCE_API_KEY: 'test-nvidia-key',
    NV_INFERENCE_BASE_URL: localAgentModel.baseUrl,
  });
  expect(runtime.sensingEnv).not.toHaveProperty('NV_INFERENCE_API_KEY');
  expect(
    fs.statSync(path.join(mockDirectory, 'coco-model-credentials.json')).mode &
      0o777,
  ).toBe(0o600);
});

it('still requires sensing credentials by default', () => {
  expect(() => saveModelConfiguration(input)).toThrow('requires an API key');
});

it('reuses the matching tutor key for sensing only when local sharing is enabled', () => {
  saveModelConfiguration(input, { sensingEnabled: false });
  const runtime = resolveModelRuntime({ shareTutorWithSensing: true })!;
  expect(runtime.sensingEnv.NV_INFERENCE_API_KEY).toBe('test-nvidia-key');
  expect(runtime.sensingEnv.NV_INFERENCE_BASE_URL).toBe(localAgentModel.baseUrl);
  // Sharing is in memory only, never a migration of the stored credentials.
  expect(resolveModelRuntime()!.sensingEnv).not.toHaveProperty('NV_INFERENCE_API_KEY');
});

it('does not forward the tutor key to a different sensing endpoint', () => {
  saveModelConfiguration({ ...input, sensing: { ...input.sensing, baseUrl: 'https://other.example.test/v1' } }, { sensingEnabled: false });
  expect(resolveModelRuntime({ shareTutorWithSensing: true })!.sensingEnv).not.toHaveProperty('NV_INFERENCE_API_KEY');
});

it('requires a tutor key even when sensing is disabled', () => {
  expect(() =>
    saveModelConfiguration(
      { ...input, credentials: {} },
      { sensingEnabled: false },
    ),
  ).toThrow('requires an API key');
});

it('tests the same NVIDIA route and does not persist an unsaved key', () => {
  const result = prepareModelConnectionTest(
    localAgentModel,
    'tutor',
    'test-probe-key',
  );
  expect(result.connection.model).toBe(`nv_inference/${localAgentModel.model}`);
  expect(result.env).toEqual({
    NV_INFERENCE_API_KEY: 'test-probe-key',
    NV_INFERENCE_BASE_URL: localAgentModel.baseUrl,
  });
  expect(fs.readdirSync(mockDirectory)).toEqual([]);
  expect(() =>
    prepareModelConnectionTest(
      { ...localAgentModel, baseUrl: '' },
      'tutor',
      'test-probe-key',
    ),
  ).toThrow('base URL');
});
