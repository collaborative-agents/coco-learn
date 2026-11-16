import { useEffect, useState } from 'react';
import {
  DEFAULT_TUTOR_MODEL,
  OBSERVER_MODEL,
} from '../../../shared/model-catalog';
import type { ModelDraft, ConnectionTestStatus } from './ModelsStep';
import localAgentModel from '../../../shared/local-agent-model';

export default function useModelSetup(
  routerManagedFromMain: boolean,
  localAgent = false,
) {
  const [modelError, setModelError] = useState('');
  const [routerManaged, setRouterManaged] = useState(routerManagedFromMain);
  const [savingModels, setSavingModels] = useState(false);
  const [sensingModel, setSensingModel] = useState<ModelDraft>({
    ...OBSERVER_MODEL,
    apiKey: '',
    baseUrl: '',
  });
  const [tutorModels, setTutorModels] = useState<ModelDraft[]>([
    {
      ...(localAgent ? localAgentModel : DEFAULT_TUTOR_MODEL),
      apiKey: '',
      baseUrl: localAgent ? localAgentModel.baseUrl : '',
    },
  ]);
  const [defaultTutorId, setDefaultTutorId] = useState<string>(
    localAgent ? localAgentModel.id : DEFAULT_TUTOR_MODEL.id,
  );
  const [connectionTests, setConnectionTests] = useState<
    Record<string, ConnectionTestStatus>
  >({});

  const testModelConnection = async (
    role: 'sensing' | 'tutor',
    model: ModelDraft,
  ) => {
    const key = role === 'sensing' ? 'sensing' : model.id;
    if (!model.model.trim()) {
      setConnectionTests((current) => ({
        ...current,
        [key]: { state: 'error', message: 'Enter a model ID first.' },
      }));
      return;
    }
    setConnectionTests((current) => ({
      ...current,
      [key]: { state: 'testing', message: '' },
    }));
    const result = await window.electron?.ipcRenderer.invoke(
      'test-model-connection',
      {
        role,
        connection: {
          id: model.id,
          label: model.label || (role === 'sensing' ? 'Sensing' : 'Tutor'),
          provider: model.provider,
          model: model.model,
          baseUrl: model.baseUrl,
        },
        apiKey: model.apiKey,
      },
    );
    const response = result as
      | {
          success?: boolean;
          message?: string;
          error?: string;
        }
      | undefined;
    setConnectionTests((current) => ({
      ...current,
      [key]: response?.success
        ? { state: 'success', message: response.message || 'Connected.' }
        : { state: 'error', message: response?.error || 'Connection failed.' },
    }));
  };

  useEffect(() => {
    window.electron?.ipcRenderer
      .invoke('get-llm-router-status')
      .then((status: any) => setRouterManaged(status?.configured === true))
      .catch(() => {});

    window.electron?.ipcRenderer
      .invoke('get-model-configuration')
      .then((config: any) => {
        if (!config?.sensing || !Array.isArray(config.tutors)) return undefined;
        setSensingModel({
          ...config.sensing,
          model: String(config.sensing.model).replace(
            /^(?:hosted_vllm|tinker|nv_inference)\//,
            '',
          ),
          apiKey: '',
          baseUrl: config.sensing.baseUrl ?? '',
        });
        setTutorModels(
          config.tutors.map((item: any) => ({
            ...item,
            model: String(item.model).replace(
              /^(?:hosted_vllm|tinker|nv_inference)\//,
              '',
            ),
            apiKey: '',
            baseUrl: item.baseUrl ?? '',
          })),
        );
        setDefaultTutorId(config.defaultTutorId);
        return undefined;
      })
      .catch(() => {});
  }, []);

  const saveModels = async () => {
    try {
      if (!localAgent && !sensingModel.model.trim()) {
        setModelError('Enter a vision-capable sensing model.');
        return false;
      }
      if (
        tutorModels.some((item) => !item.label.trim() || !item.model.trim())
      ) {
        setModelError('Give every tutor model a name and model ID.');
        return false;
      }
      setSavingModels(true);
      setModelError('');
      const credentials: Record<string, string> = {};
      if (sensingModel.apiKey.trim()) {
        credentials[`sensing:${sensingModel.provider}`] = sensingModel.apiKey;
      }
      tutorModels.forEach((item) => {
        if (item.apiKey.trim())
          credentials[`tutor:${item.provider}`] = item.apiKey;
      });
      // Local development uses the selected tutor for both roles. The main
      // process supplies its key to sensing only for this matching connection.
      const sensing = localAgent
        ? (tutorModels.find((item) => item.id === defaultTutorId) ??
          tutorModels[0])
        : sensingModel;
      const result = await window.electron?.ipcRenderer.invoke(
        'save-model-configuration',
        {
          sensing: {
            id: 'sensing',
            label: 'Sensing',
            provider: sensing.provider,
            model: sensing.model,
            baseUrl: sensing.baseUrl,
          },
          tutors: tutorModels.map((item) => ({
            id: item.id,
            label: item.label,
            provider: item.provider,
            model: item.model,
            baseUrl: item.baseUrl,
          })),
          defaultTutorId,
          credentials,
        },
      );
      setSavingModels(false);
      if (!(result as { success?: boolean })?.success) {
        setModelError(
          (result as { error?: string })?.error ||
            'Could not save model configuration.',
        );
        return false;
      }

      return true;
    } catch {
      setModelError('Could not save model configuration. Please try again.');
      return false;
    } finally {
      setSavingModels(false);
    }
  };
  return {
    routerManaged,
    savingModels,
    saveModels,
    modelProps: {
      sensing: sensingModel,
      setSensing: setSensingModel,
      tutors: tutorModels,
      setTutors: setTutorModels,
      defaultTutorId,
      setDefaultTutorId,
      error: modelError,
      testStatuses: connectionTests,
      onTest: testModelConnection,
      routerManaged,
      localAgent,
    },
  };
}
