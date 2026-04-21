import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Layers,
  BookOpen,
  Cpu,
  Activity,
  Globe,
  BarChart3,
  Menu,
  X,
  Terminal,
  CheckCircle2,
  Moon,
  Sun,
  Siren,
  Keyboard,
  StickyNote,
  Sparkles,
  ClipboardList,
  Map,
  Shield,
  Server,
  Database,
  Code2,
  KanbanSquare,
  ListChecks,
  Wrench as Tool,
  Lightbulb,
  Eye,
} from 'lucide-react';
import { ModuleData, Client, ClientVertical, Note } from '../types';
import { ClientCreationOptions } from '../utils/projectProfile';
import ClientSwitcher from './ClientSwitcher';
import NotesPanel from './NotesPanel';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './ui/LanguageSwitcher';
import { InternalShell } from './shell/ShellVariants';
import ConfirmDialog from './ui/ConfirmDialog';
import { useToast } from './ui/ToastContext';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  onClick?: () => void;
  isComplete?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, subLabel, onClick, isComplete }) => {
  const location = useLocation();
  const [targetPath, targetQuery = ''] = to.split('?');
  const isActive = targetQuery
    ? location.pathname === targetPath && location.search === `?${targetQuery}`
    : location.pathname === targetPath;

  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        isActive
          ? 'bg-primary text-white shadow-lg shadow-primary/30'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
      }`}
    >
      <div
        className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary dark:group-hover:text-primary'}`}
      >
        {icon}
      </div>
      <div className="flex flex-col flex-1">
        <span className={`text-sm font-medium ${isActive ? 'text-white' : ''}`}>{label}</span>
        {subLabel && (
          <span
            className={`text-[10px] uppercase tracking-wider ${isActive ? 'text-white/80' : 'text-slate-400'}`}
          >
            {subLabel}
          </span>
        )}
      </div>
      {isComplete && !isActive && <CheckCircle2 size={16} className="text-emerald-500" />}
    </NavLink>
  );
};

interface LayoutProps {
  children: React.ReactNode;
  modules: ModuleData[];
  globalScore: number;
  clients?: Client[];
  currentClientId?: string;
  onSwitchClient?: (id: string) => void;
  onAddClient?: (name: string, vertical: ClientVertical, options?: ClientCreationOptions) => void;
  onDeleteClient?: (id: string) => void;
  // Notes Props
  generalNotes?: Note[];
  projectNotes?: Note[];
  onAddNote?: (content: string, type: 'project' | 'general') => void;
  onUpdateNote?: (noteId: string, content: string, type: 'project' | 'general') => void;
  onDeleteNote?: (noteId: string, type: 'project' | 'general') => void;
}

type TabType = 'analitica' | 'estrategia' | 'acciones' | 'backend' | 'admin';

const Layout: React.FC<LayoutProps> = ({
  children,
  modules,
  globalScore,
  clients,
  currentClientId,
  onSwitchClient,
  onAddClient,
  onDeleteClient,
  generalNotes = [],
  projectNotes = [],
  onAddNote = () => {},
  onUpdateNote = () => {},
  onDeleteNote = () => {},
}) => {
  const { t } = useTranslation();
  const { successAction } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('mediaflow_theme') === 'dark',
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const activeTab = useMemo<TabType>(() => {
    const path = location.pathname;
    if (
      path === '/' ||
      path === '/app' ||
      path === '/app/' ||
      path.startsWith('/app/checklist') ||
      path.startsWith('/app/trends-media') ||
      path.startsWith('/app/gsc-impact')
    ) {
      return 'analitica';
    }
    if (
      path.startsWith('/app/client-roadmap') ||
      path.startsWith('/app/ai-roadmap') ||
      path.startsWith('/app/ia-visibility') ||
      path.startsWith('/app/module')
    ) {
      return 'estrategia';
    }
    if (
      path.startsWith('/app/kanban') ||
      path.startsWith('/app/settings') ||
      path.startsWith('/app/completed-tasks')
    ) {
      return 'acciones';
    }
    if (path.startsWith('/app/admin')) {
      return 'admin';
    }
    if (path.startsWith('/app/tools-hub')) {
      return 'backend';
    }
    return 'analitica';
  }, [location.pathname]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('mediaflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('mediaflow_theme', 'light');
    }
  }, [darkMode]);


  const handleTabChange = (tab: TabType) => {
    if (tab === 'backend') {
      navigate('/app/tools-hub');
      return;
    }
    switch (tab) {
      case 'analitica':
        navigate('/app/');
        break;
      case 'estrategia':
        navigate('/app/client-roadmap');
        break;
      case 'acciones':
        navigate('/app/kanban');
        break;
      case 'admin':
        navigate('/app/admin/ideas');
        break;
    }
  };

  const handleEmergencyIndex = () => {
    setShowEmergencyConfirm(true);
  };

  const confirmEmergencyIndex = () => {
    setShowEmergencyConfirm(false);
    setIsEmergencyLoading(true);
    setTimeout(() => {
      setIsEmergencyLoading(false);
      successAction(t('feedback.actions.send_emergency_index_request'));
    }, 2000);
  };

  const getIcon = (name: string) => {
    switch (name) {
      case 'Search':
        return <Search size={20} />;
      case 'Layers':
        return <Layers size={20} />;
      case 'BookOpen':
        return <BookOpen size={20} />;
      case 'Cpu':
        return <Cpu size={20} />;
      case 'Activity':
        return <Activity size={20} />;
      case 'Globe':
        return <Globe size={20} />;
      case 'BarChart3':
        return <BarChart3 size={20} />;
      case 'Sparkles':
        return <Sparkles size={20} />;
      default:
        return <Search size={20} />;
    }
  };

  const renderSidebarContent = () => {
    switch (activeTab) {
      case 'analitica':
        return (
          <>
            <NavItem
              to="/app/"
              icon={<LayoutDashboard size={20} />}
              label={t('nav.dashboard')}
              subLabel={t('nav.dashboard_sub')}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavItem
              to="/app/checklist"
              icon={<ListChecks size={20} />}
              label="Agrupación y Clusterización"
              subLabel="Análisis SEO y Clusters"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavItem
              to="/app/gsc-impact?view=individual"
              icon={<BarChart3 size={20} />}
              label="Impacto GSC · Propiedad"
              subLabel="Análisis por propiedad"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavItem
              to="/app/gsc-impact?view=global"
              icon={<Globe size={20} />}
              label="Impacto GSC · Portfolio"
              subLabel="Vista global multi-site"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          </>
        );
      case 'estrategia':
        return (
          <>
            <NavItem
              to="/app/client-roadmap"
              icon={<Map size={20} />}
              label={t('nav.client_roadmap')}
              subLabel={t('nav.client_roadmap_sub')}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavItem
              to="/app/ai-roadmap"
              icon={<Sparkles size={20} />}
              label={t('nav.ai_roadmap')}
              subLabel={t('nav.ai_roadmap_sub')}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavItem
              to="/app/ia-visibility"
              icon={<Eye size={20} />}
              label={t('nav.ia_visibility')}
              subLabel={t('nav.ia_visibility_sub')}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="my-4 border-t border-slate-100 dark:border-slate-800"></div>
            <div className="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              Módulos de Auditoría
            </div>
            {modules.map((mod) => {
              const isComplete =
                mod.tasks.length > 0 && mod.tasks.every((t) => t.status === 'completed');
              return (
                <NavItem
                  key={mod.id}
                  to={`/app/module/${mod.id}`}
                  icon={getIcon(mod.iconName)}
                  label={`${t('nav.module_prefix')}${mod.id}: ${mod.title}`}
                  subLabel={mod.levelRange}
                  onClick={() => setIsMobileMenuOpen(false)}
                  isComplete={isComplete}
                />
              );
            })}
          </>
        );
      case 'acciones':
        return (
          <>
            <NavItem
              to="/app/kanban"
              icon={<KanbanSquare size={20} />}
              label={t('nav.kanban_board')}
              subLabel={t('nav.kanban_board_sub')}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavItem
              to="/app/completed-tasks"
              icon={<ClipboardList size={20} />}
              label={t('nav.completed_tasks')}
              subLabel={t('nav.completed_tasks_sub')}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavItem
              to="/app/tools-hub"
              icon={<Tool size={20} />}
              label="Tools Hub"
              subLabel="Legacy / Migrada / Beta"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          </>
        );
      case 'admin':
        return (
          <>
            <NavItem
              to="/app/admin/ideas"
              icon={<Lightbulb size={20} />}
              label="Mejoras Back/Front"
              subLabel="Sugerencias"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          </>
        );
      default:
        return null;
    }
  };

  const header = (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <span className="hidden lg:block">
              <span className="text-primary">agencia</span>
              <span className="text-danger">seo</span>
              <span className="text-primary">.eu</span>
            </span>
          </div>

          {/* Tabs */}
          <nav className="hidden lg:flex items-center space-x-1">
            {(['analitica', 'estrategia', 'acciones', 'backend', 'admin'] as TabType[]).map(
              (tab) => {
                let toPath = '/app/';
                if (tab === 'estrategia') toPath = '/app/client-roadmap';
                if (tab === 'acciones') toPath = '/app/kanban';
                if (tab === 'admin') toPath = '/app/admin/ideas';
                if (tab === 'backend') toPath = '/app/tools-hub';

                return (
                  <NavLink
                    key={tab}
                    to={toPath}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange(tab);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                      activeTab === tab
                        ? 'bg-danger/10 text-primary dark:bg-primary/30 dark:text-white ring-1 ring-danger/30'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab === 'backend' ? 'Tools Hub' : tab === 'analitica' ? 'Analítica' : tab}
                  </NavLink>
                );
              },
            )}
          </nav>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden text-slate-600 dark:text-slate-300"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>

        {/* Right Side Actions */}
        <div className="hidden lg:flex items-center gap-3">
          {clients && onSwitchClient && onAddClient && onDeleteClient && (
            <div className="w-64">
              <ClientSwitcher
                clients={clients}
                currentClientId={currentClientId || ''}
                onSwitchClient={onSwitchClient}
                onAddClient={onAddClient}
                onDeleteClient={onDeleteClient}
              />
            </div>
          )}
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
          <LanguageSwitcher />
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition-colors"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
  );

  const sidebar = (
    <aside
        className={`
        fixed top-16 bottom-0 left-0 z-40 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col pt-4
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:mt-16
      `}
      >
        <div className="px-4 pb-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {/* Mobile Client Switcher */}
          <div className="lg:hidden mb-4">
            {clients && onSwitchClient && onAddClient && onDeleteClient && (
              <ClientSwitcher
                clients={clients}
                currentClientId={currentClientId || ''}
                onSwitchClient={onSwitchClient}
                onAddClient={onAddClient}
                onDeleteClient={onDeleteClient}
              />
            )}

            {/* Mobile Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(['analitica', 'estrategia', 'acciones', 'backend', 'admin'] as TabType[]).map(
                (tab) => {
                  let toPath = '/app/';
                  if (tab === 'estrategia') toPath = '/app/client-roadmap';
                  if (tab === 'acciones') toPath = '/app/kanban';
                  if (tab === 'admin') toPath = '/app/admin/ideas';
                  if (tab === 'backend') toPath = '/app/tools-hub';

                  return (
                    <NavLink
                      key={tab}
                      to={toPath}
                      onClick={(e) => {
                        e.preventDefault();
                        handleTabChange(tab);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`block text-center px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border ${
                        activeTab === tab
                          ? 'bg-primary text-white border-primary'
                          : 'text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {tab === 'backend' ? 'Tools' : tab === 'analitica' ? 'Analítica' : tab}
                    </NavLink>
                  );
                },
              )}
            </div>
          </div>

          {activeTab === 'analitica' && (
            <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-4 text-white relative overflow-hidden mb-6 border border-slate-800 dark:border-slate-700 shrink-0">
              <div className="absolute top-0 right-0 w-20 h-20 bg-danger rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                {t('global_score')}
              </p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold">{Math.round(globalScore)}</span>
                <span className="text-slate-400 mb-1">/ 100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-danger to-primary h-full rounded-full transition-all duration-1000"
                  style={{ width: `${globalScore}%` }}
                ></div>
              </div>
            </div>
          )}

          <nav className="space-y-1 pr-2">{renderSidebarContent()}</nav>

          <div className="mt-auto pt-6 pb-2 space-y-3">
            <button
              onClick={handleEmergencyIndex}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-bold transition-all shadow-lg ${isEmergencyLoading ? 'bg-red-700' : 'bg-red-600 hover:bg-red-700 animate-pulse-slow'}`}
            >
              {isEmergencyLoading ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
              ) : (
                <Siren size={20} />
              )}
              {isEmergencyLoading ? t('nav.indexing') : t('nav.emergency_index')}
            </button>

            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2"
            >
              <Keyboard size={14} /> {t('nav.shortcuts')}
            </button>

            <button
              onClick={() => setIsNotesOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-2 rounded-xl text-slate-500 hover:text-primary hover:bg-danger/10 dark:hover:bg-slate-800 transition-colors"
            >
              <StickyNote size={20} />
              <span className="font-medium">{t('nav.notes')}</span>
            </button>
          </div>
        </div>
      </aside>
  );

  return (
    <InternalShell header={header} sidebar={sidebar} contentClassName="flex-1 overflow-auto pt-16 w-full">
      <ConfirmDialog
        isOpen={showEmergencyConfirm}
        title={t('feedback.confirm.emergency_index_title')}
        message={t('feedback.confirm.emergency_index_message')}
        confirmLabel={t('feedback.confirm.confirm_button')}
        cancelLabel={t('feedback.confirm.cancel_button')}
        onConfirm={confirmEmergencyIndex}
        onCancel={() => setShowEmergencyConfirm(false)}
        isDestructive={false}
      />
      {/* Notes Panel */}
      <NotesPanel
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        projectNotes={projectNotes}
        generalNotes={generalNotes}
        onAddNote={onAddNote}
        onUpdateNote={onUpdateNote}
        onDeleteNote={onDeleteNote}
        projectName={clients?.find((c) => c.id === currentClientId)?.name || 'Proyecto'}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/50 w-full relative">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">{children}</div>

        {/* Shortcuts Modal (Simple) */}
        {showShortcuts && (
          <div
            className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setShowShortcuts(false)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                  <Keyboard size={20} /> Atajos de Teclado
                </h3>
                <button onClick={() => setShowShortcuts(false)}>
                  <X className="text-slate-400 hover:text-slate-600" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                    CMD + K
                  </span>{' '}
                  <span>Búsqueda Rápida</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                    CMD + J
                  </span>{' '}
                  <span>Modo Oscuro</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                    ESC
                  </span>{' '}
                  <span>Cerrar Modales</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </InternalShell>
  );
};

export default Layout;
