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

/** Explicit local credentials enable the agent only in an unpackaged dev run. */
export function configureLocalAgent(
  packaged: boolean,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const enabled =
    !packaged &&
    environment.NODE_ENV === 'development' &&
    environment.COCO_LOCAL_AGENT === '1';
  if (enabled) {
    // Empty values also prevent Python's dotenv loader restoring the shared router.
    environment.LLM_ROUTER_URL = '';
    environment.LLM_ROUTER_API_KEY = '';
    environment.COCO_GATEWAY_ENABLED = '0';
  }
  return enabled;
}
