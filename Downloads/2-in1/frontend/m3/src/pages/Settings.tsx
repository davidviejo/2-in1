import React, { useMemo, useState } from 'react';
import { Save, Key, AlertTriangle } from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useProject } from '../context/ProjectContext';
import DataManagementPanel from '../components/DataManagementPanel';
import { parseBrandTerms } from '../utils/brandTerms';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

const Settings: React.FC = () => {
  const { settings, updateSettings, saveSettings, serverSyncError, getApiKeySource } = useSettings();
  const { clients, currentClientId, switchClient, currentClient, updateCurrentClientProfile } = useProject();
  const { success, warning } = useToast();

  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey || '');
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey || '');
  const [mistralKey, setMistralKey] = useState(settings.mistralApiKey || '');
  const [dataforseoLogin, setDataforseoLogin] = useState(settings.dataforseoLogin || '');
  const [dataforseoPassword, setDataforseoPassword] = useState(settings.dataforseoPassword || '');
  const [serpApiKey, setSerpApiKey] = useState(settings.serpApiKey || '');
  const [defaultSerpProvider, setDefaultSerpProvider] = useState<'dataforseo' | 'serpapi'>(
    settings.defaultSerpProvider || 'dataforseo',
  );

  const [openaiModel, setOpenaiModel] = useState(settings.openaiModel || 'gpt-4o');
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel || 'gemini-1.5-pro');
  const [mistralModel, setMistralModel] = useState(settings.mistralModel || 'mistral-large-latest');
  const [gscClientId, setGscClientId] = useState(settings.gscClientId || '');
  const [brandTermsText, setBrandTermsText] = useState((settings.brandTerms || []).join('\n'));
  const [projectNotes, setProjectNotes] = useState(currentClient?.notes?.[0]?.content || '');
  const [brandedKeywordsText, setBrandedKeywordsText] = useState((currentClient?.brandedKeywords || []).join('\n'));
  const [clusterDraft, setClusterDraft] = useState((currentClient?.seoClusters || []).map((cluster) => `${cluster.name}: ${cluster.urls.join(', ')}`).join('\n'));

  const parsedBrandTerms = useMemo(() => parseBrandTerms(brandTermsText), [brandTermsText]);
  const parsedBrandedKeywords = useMemo(() => parseBrandTerms(brandedKeywordsText), [brandedKeywordsText]);
  const parsedSeoClusters = useMemo(
    () =>
      clusterDraft
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [namePart, ...rest] = line.split(':');
          const urlsText = rest.join(':');
          return {
            id: `${namePart.trim().toLowerCase().replace(/\s+/g, '-') || 'cluster'}-${index}`,
            name: namePart.trim() || `Cluster ${index + 1}`,
            urls: urlsText
              .split(',')
              .map((url) => url.trim())
              .filter(Boolean),
          };
        }),
    [clusterDraft],
  );

  const handleSave = async () => {
    const nextSettings = {
      openaiApiKey: openaiKey,
      geminiApiKey: geminiKey,
      mistralApiKey: mistralKey,
      dataforseoLogin,
      dataforseoPassword,
      serpApiKey,
      defaultSerpProvider,
      openaiModel,
      geminiModel,
      mistralModel,
      gscClientId,
      brandTerms: parsedBrandTerms,
    };

    updateSettings(nextSettings);
    const serverSaved = await saveSettings(nextSettings);

    if (!serverSaved) {
      warning('Guardado local aplicado. El guardado de servidor falló.');
      return;
    }

    success('Configuración guardada. Prioridad: servidor > env > local.');
  };

  return (
    <div className="page-shell mx-auto max-w-4xl animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-brand-lg bg-surface-alt text-primary shadow-brand">
          <Key size={24} />
        </div>
        <div>
          <h1 className="section-title">Ajustes del Sistema</h1>
          <p className="section-subtitle">
            Distingue credenciales de servidor y ajustes locales del navegador.
          </p>
        </div>
      </div>

      <Card className="bg-primary-soft/30">
        <h3 className="mb-2 font-bold text-foreground">Prioridad de resolución documentada</h3>
        <p className="text-sm text-muted">
          Credenciales compatibles con backend: <strong>servidor &gt; variables de entorno &gt; local</strong>.
          Ajustes locales (Gemini, Mistral, GSC y términos de marca) se mantienen en este navegador.
        </p>
        {serverSyncError && <p className="mt-2 text-sm text-warning">{serverSyncError}</p>}
      </Card>

      <Card>
        <div className="mb-6 border-b border-border pb-4">
          <h2 className="text-lg font-bold text-foreground">Panel de ajustes por cliente</h2>
          <p className="text-sm text-muted">Define datos SEO del proyecto y consulta snapshots guardados.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Cliente activo</label>
            <select
              value={currentClientId}
              onChange={(e) => {
                const nextClientId = e.target.value;
                switchClient(nextClientId);
                const nextClient = clients.find((client) => client.id === nextClientId);
                setBrandedKeywordsText((nextClient?.brandedKeywords || []).join('\n'));
                setClusterDraft((nextClient?.seoClusters || []).map((cluster) => `${cluster.name}: ${cluster.urls.join(', ')}`).join('\n'));
                setProjectNotes(nextClient?.notes?.[0]?.content || '');
              }}
              className="form-control"
            >
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">KWs branded (una por línea)</label>
            <textarea value={brandedKeywordsText} onChange={(e) => setBrandedKeywordsText(e.target.value)} className="form-textarea" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Clusters manuales (formato: Cluster: url1, url2)</label>
            <textarea value={clusterDraft} onChange={(e) => setClusterDraft(e.target.value)} className="form-textarea" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Datos relevantes del proyecto</label>
            <textarea value={projectNotes} onChange={(e) => setProjectNotes(e.target.value)} className="form-textarea" />
          </div>
          <div className="rounded-brand-md border border-border bg-surface-alt p-3 text-sm">
            <p className="font-semibold text-foreground">Historial de snapshots SEO</p>
            <p className="text-muted">Snapshots guardados para este cliente: {(currentClient?.seoSnapshots || []).length}.</p>
            <p className="text-xs text-muted mt-1">Puedes ver el detalle completo desde el Dashboard en “Histórico de snapshots SEO”.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              updateCurrentClientProfile({
                projectType: currentClient?.projectType,
                sector: currentClient?.sector,
                geoScope: currentClient?.geoScope,
                brandTerms: currentClient?.brandTerms || [],
                analysisProjectTypes: currentClient?.analysisProjectTypes || [],
                brandedKeywords: parsedBrandedKeywords,
                seoClusters: parsedSeoClusters,
              })
            }
          >
            Guardar ajustes del cliente
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-6 border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Credenciales de servidor</h2>
            <span className="text-xs text-muted">Persistidas en backend</span>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-foreground">OpenAI (ChatGPT)</label>
              <span className="text-xs text-muted">Fuente activa: {getApiKeySource('openai')}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted">API Key</label>
                <Input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Modelo</label>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="form-control"
                >
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="space-y-4">
            <label className="text-sm font-bold text-foreground">DataForSEO</label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted">Login</label>
                <Input
                  type="text"
                  value={dataforseoLogin}
                  onChange={(e) => setDataforseoLogin(e.target.value.trim())}
                  placeholder="email@login.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Password</label>
                <Input
                  type="password"
                  value={dataforseoPassword}
                  onChange={(e) => setDataforseoPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-foreground">Proveedor SERP por defecto</label>
            <select
              value={defaultSerpProvider}
              onChange={(e) => setDefaultSerpProvider(e.target.value as 'dataforseo' | 'serpapi')}
              className="form-control"
            >
              <option value="dataforseo">DataForSEO</option>
              <option value="serpapi">SerpApi</option>
            </select>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-foreground">SerpApi</label>
            <div className="space-y-1">
              <label className="text-xs text-muted">API Key</label>
              <Input
                type="password"
                value={serpApiKey}
                onChange={(e) => setSerpApiKey(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxx"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-6 border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Credenciales locales (navegador)</h2>
            <span className="text-xs text-muted">No se envían al backend</span>
          </div>
        </div>
        <div className="space-y-6">
          <div className="space-y-4">
            <label className="text-sm font-bold text-foreground">Google Gemini</label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
              />
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="form-control"
              >
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-pro">Gemini Pro (Legacy)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-foreground">Mistral AI</label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                type="password"
                value={mistralKey}
                onChange={(e) => setMistralKey(e.target.value)}
                placeholder="..."
              />
              <select
                value={mistralModel}
                onChange={(e) => setMistralModel(e.target.value)}
                className="form-control"
              >
                <option value="mistral-large-latest">Mistral Large</option>
                <option value="mistral-medium">Mistral Medium</option>
                <option value="mistral-small">Mistral Small</option>
                <option value="open-mixtral-8x22b">Mixtral 8x22B</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">OAuth 2.0 Client ID (GSC)</label>
            <Input
              type="text"
              value={gscClientId}
              onChange={(e) => setGscClientId(e.target.value)}
              placeholder="xxxx-xxxx.apps.googleusercontent.com"
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-6 border-b border-border pb-4">
          <h2 className="text-lg font-bold text-foreground">Términos de marca</h2>
        </div>
        <div className="space-y-2">
          <textarea
            value={brandTermsText}
            onChange={(e) => setBrandTermsText(e.target.value)}
            placeholder={'mi marca\nmarca oficial\nnombre comercial'}
            className="form-textarea"
          />
          <p className="text-xs text-muted">Detectados: {parsedBrandTerms.length}.</p>
        </div>
      </Card>

      <div className="flex items-center gap-4 pt-4">
        <Button onClick={() => void handleSave()}>
          <Save size={18} />
          Guardar Configuración
        </Button>
      </div>

      <Card className="bg-primary-soft/40">
        <h3 className="mb-2 flex items-center gap-2 font-bold text-foreground">
          <AlertTriangle size={18} /> Almacenamiento Local
        </h3>
        <p className="text-sm text-muted">
          Si el backend no está disponible, el sistema seguirá funcionando con copia local y/o variables
          de entorno.
        </p>
      </Card>

      <DataManagementPanel />
    </div>
  );
};

export default Settings;
