import { IconProvider, Toaster, TooltipProvider } from '@duckdev45/eagle-component';
import { IconContext } from '@phosphor-icons/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles/index.css';

// eagle-component's <IconProvider> sets Phosphor's context to `{ weight }`
// only, which REPLACES Phosphor's default context — dropping `size: '1em'`
// and `color: 'currentColor'`. Any icon not inside an Eagle slot (Button's
// leadingIcon etc.) then renders with no width/height and stretches to fill
// its container. Restoring the defaults here until the library merges them.
const ICON_DEFAULTS = { weight: 'bold', size: '1em', color: 'currentColor', mirrored: false } as const;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconProvider>
      <IconContext.Provider value={ICON_DEFAULTS}>
        <TooltipProvider>
          <App />
        </TooltipProvider>
        {/* Lifted above the people dock so toasts never cover it. */}
        <Toaster position="bottom-center" offset={{ bottom: 76 }} mobileOffset={{ bottom: 120 }} />
      </IconContext.Provider>
    </IconProvider>
  </StrictMode>,
);
