/** @jest-environment node */
import isInterfacePreview, { configureLocalAgent } from './interface-preview';

it.each([
  [false, 'development', '1', true],
  [false, 'development', undefined, false],
  [false, 'development', '0', false],
  [false, 'production', '1', false],
  [false, undefined, '1', false],
  [true, 'development', '1', false],
  [true, 'production', '1', false],
])(
  'checks the preview boundary (packaged=%s, mode=%s, flag=%s)',
  (packaged, mode, flag, expected) => {
    expect(
      isInterfacePreview(packaged, {
        NODE_ENV: mode,
        COCO_INTERFACE_PREVIEW: flag,
      }),
    ).toBe(expected);
  },
);

it.each([
  [false, 'development', '1', true],
  [false, 'development', undefined, false],
  [false, 'development', '0', false],
  [false, 'production', '1', false],
  [true, 'development', '1', false],
  [true, 'production', '1', false],
])(
  'isolates local agent access (%s, %s, %s)',
  (packaged, mode, flag, expected) => {
    const environment = {
      NODE_ENV: mode,
      COCO_LOCAL_AGENT: flag,
      LLM_ROUTER_URL: 'https://router.example.test',
      LLM_ROUTER_API_KEY: 'test-router-key',
      COCO_GATEWAY_ENABLED: '1',
    };
    const original = { ...environment };
    expect(configureLocalAgent(packaged, environment)).toBe(expected);
    expect(environment).toEqual(
      expected
        ? {
            ...original,
            LLM_ROUTER_URL: '',
            LLM_ROUTER_API_KEY: '',
            COCO_GATEWAY_ENABLED: '0',
          }
        : original,
    );
  },
);
