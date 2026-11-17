/** @jest-environment node */
import isInterfacePreview from './interface-preview';

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
