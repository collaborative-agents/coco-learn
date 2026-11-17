/** Local UI preview must never bypass login in a packaged or production app. */
export default function isInterfacePreview(
  packaged: boolean,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    !packaged &&
    environment.NODE_ENV === 'development' &&
    environment.COCO_INTERFACE_PREVIEW === '1'
  );
}
