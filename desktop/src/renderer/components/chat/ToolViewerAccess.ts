import { createContext } from 'react';

// The workspace supplies the persisted entitlement; standalone previews stay usable.
const ToolViewerAccess = createContext(true);
export default ToolViewerAccess;
