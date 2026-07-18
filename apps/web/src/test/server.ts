import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

/** Shared MSW server — auth flows span several endpoints, which `vi.stubGlobal` can't model. */
export const server = setupServer(...handlers);
