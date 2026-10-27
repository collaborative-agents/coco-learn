import { createContext } from 'react';

// The workspace provides the saved chapter entitlement; isolated previews work.
const ContextViewerAccess = createContext(true);
export default ContextViewerAccess;
