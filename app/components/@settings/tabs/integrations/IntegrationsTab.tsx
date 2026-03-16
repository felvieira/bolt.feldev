import { useState, useEffect, useCallback } from 'react';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';

interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  storageKey: string;
  fields: IntegrationField[];
  alwaysAvailable?: boolean;
  externalLink?: string;
}

interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  required?: boolean;
}

interface IntegrationState {
  enabled: boolean;
  values: Record<string, string>;
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'context7',
    name: 'Context7',
    description: 'Get up-to-date documentation for any library',
    icon: 'i-ph:book-open',
    enabled: true,
    storageKey: 'bolt_integration_context7',
    fields: [],
    alwaysAvailable: true,
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Import designs directly from Figma',
    icon: 'i-ph:figma-logo',
    enabled: false,
    storageKey: 'bolt_integration_figma',
    fields: [
      {
        key: 'accessToken',
        label: 'Access Token',
        type: 'password',
        placeholder: 'Enter your Figma access token',
        required: true,
      },
    ],
  },
  {
    id: 'falai',
    name: 'fal.ai',
    description: 'Generate images with FLUX AI models',
    icon: 'i-ph:image',
    enabled: false,
    storageKey: 'bolt_integration_falai',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'Enter your fal.ai API key',
        required: true,
      },
    ],
  },
  {
    id: 'unsplash',
    name: 'Unsplash',
    description: 'Search and use free stock photos',
    icon: 'i-ph:camera',
    enabled: false,
    storageKey: 'bolt_integration_unsplash',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key (optional)',
        type: 'password',
        placeholder: 'Enter your Unsplash API key (optional)',
        required: false,
      },
    ],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Connect to Supabase for database features',
    icon: 'i-ph:database',
    enabled: false,
    storageKey: 'bolt_integration_supabase',
    fields: [],
    externalLink: 'supabase',
  },
];

function loadState(storageKey: string): IntegrationState {
  try {
    const raw = localStorage.getItem(storageKey);

    if (raw) {
      return JSON.parse(raw) as IntegrationState;
    }
  } catch {
    // ignore
  }

  return { enabled: false, values: {} };
}

function saveState(storageKey: string, state: IntegrationState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function IntegrationCard({
  integration,
  onNavigate,
}: {
  integration: IntegrationConfig;
  onNavigate?: (tab: string) => void;
}) {
  const [state, setState] = useState<IntegrationState>(() => {
    const loaded = loadState(integration.storageKey);
    return {
      enabled: integration.alwaysAvailable ? loaded.enabled !== false : loaded.enabled,
      values: loaded.values,
    };
  });
  const [expanded, setExpanded] = useState(false);

  const isConnected =
    integration.alwaysAvailable ||
    (state.enabled &&
      integration.fields.filter((f) => f.required).every((f) => state.values[f.key]?.trim()));

  const handleToggle = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      saveState(integration.storageKey, next);
      toast.success(`${integration.name} ${next.enabled ? 'enabled' : 'disabled'}`);
      return next;
    });
  }, [integration]);

  const handleFieldChange = useCallback(
    (fieldKey: string, value: string) => {
      setState((prev) => {
        const next = { ...prev, values: { ...prev.values, [fieldKey]: value } };
        return next;
      });
    },
    [],
  );

  const handleSave = useCallback(() => {
    saveState(integration.storageKey, state);
    toast.success(`${integration.name} configuration saved`);
  }, [integration, state]);

  // Auto-save enabled state was already handled in handleToggle;
  // field values require explicit save

  useEffect(() => {
    // Sync enabled from localStorage on mount (already done in useState init)
  }, []);

  return (
    <div
      className={classNames(
        'rounded-lg border transition-all duration-200',
        'border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark',
        'bg-bolt-elements-background-depth-2',
        expanded ? 'shadow-sm' : '',
      )}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => {
          if (integration.externalLink) {
            onNavigate?.(integration.externalLink);
            return;
          }

          if (integration.fields.length > 0) {
            setExpanded(!expanded);
          }
        }}
      >
        <div
          className={classNames(
            'w-8 h-8 flex items-center justify-center rounded-lg',
            'bg-bolt-elements-background-depth-3',
          )}
        >
          <div className={classNames(integration.icon, 'w-5 h-5 text-bolt-elements-textSecondary')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-bolt-elements-textPrimary">{integration.name}</span>
            {integration.externalLink && (
              <span className="text-xs text-bolt-elements-textTertiary">(see {integration.externalLink} tab)</span>
            )}
          </div>
          <p className="text-xs text-bolt-elements-textSecondary mt-0.5">{integration.description}</p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={classNames(
              'text-xs px-2 py-0.5 rounded-full',
              isConnected
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary',
            )}
          >
            {isConnected ? 'Connected' : 'Not configured'}
          </span>

          {!integration.externalLink && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className={classNames(
                'relative w-9 h-5 rounded-full transition-colors duration-200',
                state.enabled ? 'bg-green-500' : 'bg-bolt-elements-background-depth-4',
              )}
            >
              <span
                className={classNames(
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200',
                  state.enabled ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>
          )}

          {integration.fields.length > 0 && !integration.externalLink && (
            <div
              className={classNames(
                'i-ph:caret-down w-4 h-4 text-bolt-elements-textTertiary transition-transform duration-200',
                expanded ? 'rotate-180' : '',
              )}
            />
          )}
        </div>
      </div>

      {expanded && integration.fields.length > 0 && (
        <div className="px-4 pb-4 pt-0 border-t border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
          <div className="space-y-3 mt-3">
            {integration.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-bolt-elements-textSecondary mb-1">{field.label}</label>
                <input
                  type={field.type}
                  value={state.values[field.key] || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={classNames(
                    'w-full px-3 py-1.5 rounded-lg text-sm',
                    'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                    'border border-[#E5E5E5] dark:border-[#333333]',
                    'text-bolt-elements-textPrimary',
                    'focus:outline-none focus:ring-1 focus:ring-bolt-elements-focus',
                  )}
                />
              </div>
            ))}
            <button
              onClick={handleSave}
              className={classNames(
                'px-4 py-1.5 rounded-lg text-sm',
                'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent',
                'hover:bg-bolt-elements-item-backgroundActive',
                'transition-colors duration-200',
              )}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="mb-4">
        <h2 className="text-base font-medium text-bolt-elements-textPrimary">Integrations</h2>
        <p className="text-sm text-bolt-elements-textSecondary mt-1">
          Configure external services and MCP server connections. These integrations extend bolt with additional
          capabilities.
        </p>
      </div>

      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>

      <div className="mt-4 text-xs text-bolt-elements-textTertiary">
        For advanced MCP server configuration (custom servers, stdio/SSE transports), see the{' '}
        <strong>MCP Servers</strong> tab.
      </div>
    </div>
  );
}
