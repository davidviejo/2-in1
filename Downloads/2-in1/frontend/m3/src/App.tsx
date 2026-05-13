import React, { Suspense, lazy } from 'react';
import {
  createHashRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/ui/ToastContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { SettingsProvider } from './context/SettingsContext';
import { Spinner } from './components/ui/Spinner';
import { ErrorBoundary } from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ModuleDetail = lazy(() => import('./pages/ModuleDetail'));
const CompletedTasks = lazy(() => import('./pages/CompletedTasks'));
const ClientRoadmap = lazy(() => import('./pages/ClientRoadmap'));
const KanbanBoard = lazy(() => import('./pages/KanbanBoard'));
const AIRoadmap = lazy(() => import('./pages/AIRoadmap'));
const SeoChecklistPage = lazy(() => import('./pages/SeoChecklistPage'));
const GscImpactPage = lazy(() => import('./pages/GscImpactPage'));
const SiteClusteringPage = lazy(() => import('./pages/SiteClusteringPage'));
const UnifiedClusterWorkflowPage = lazy(() => import('./pages/UnifiedClusterWorkflowPage'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminIdeasPage = lazy(() => import('./pages/admin/AdminIdeasPage'));
const TrendsMediaPage = lazy(() => import('./pages/TrendsMediaPage'));
const ToolsHub = lazy(() => import('./pages/ToolsHub'));
const GanttBoard = lazy(() => import('./pages/GanttBoard'));

const LandingPage = lazy(() => import('./pages/portal/LandingPage'));
const ClientsLogin = lazy(() => import('./pages/portal/ClientsLogin'));
const ProjectsList = lazy(() => import('./pages/portal/ProjectsList'));
const ProjectLogin = lazy(() => import('./pages/portal/ProjectLogin'));
const ProjectOverview = lazy(() => import('./pages/portal/ProjectOverview'));
const OperatorPage = lazy(() => import('./pages/portal/OperatorPage'));

const AppLayout: React.FC = () => {
  const {
    modules,
    globalScore,
    clients,
    currentClientId,
    currentClient,
    generalNotes,
    switchClient,
    addClient,
    renameClient,
    deleteClient,
    resetCurrentProject,
    addTask,
    deleteTask,
    toggleTask,
    updateTaskNotes,
    updateTaskImpact,
    toggleTaskCommunicated,
    toggleCustomRoadmapTask,
    handleReorderRoadmap,
    addManualCompletedTask,
    deleteCompletedTaskLog,
    updateCompletedTaskImpact,
    addNote,
    updateNote,
    deleteNote,
    togglePinNote,
    toggleInternalNote,
    convertNoteToTask,
  } = useProject();

  return (
    <Layout
      modules={modules}
      globalScore={globalScore}
      clients={clients}
      currentClientId={currentClientId}
      onSwitchClient={switchClient}
      onAddClient={addClient}
      onRenameClient={renameClient}
      onDeleteClient={deleteClient}
      generalNotes={generalNotes}
      projectNotes={currentClient?.notes || []}
      onAddNote={addNote}
      onUpdateNote={updateNote}
      onDeleteNote={deleteNote}
      onTogglePinNote={togglePinNote}
      onToggleInternalNote={toggleInternalNote}
      onConvertNoteToTask={convertNoteToTask}
    >
      <Outlet
        context={{
          modules,
          globalScore,
          currentClient,
          resetCurrentProject,
          toggleTask,
          addTask,
          deleteTask,
          updateTaskNotes,
          updateTaskImpact,
          toggleCustomRoadmapTask,
          toggleTaskCommunicated,
          handleReorderRoadmap,
          addManualCompletedTask,
          deleteCompletedTaskLog,
          updateCompletedTaskImpact,
        }}
      />
    </Layout>
  );
};

const AppRoutes: React.FC = () => {
  const {
    modules,
    globalScore,
    currentClient,
    resetCurrentProject,
    toggleTask,
    addTask,
    deleteTask,
    updateTaskNotes,
    updateTaskImpact,
    toggleCustomRoadmapTask,
    toggleTaskCommunicated,
    handleReorderRoadmap,
    addManualCompletedTask,
    deleteCompletedTaskLog,
    updateCompletedTaskImpact,
  } = useProject();

  const router = createHashRouter([
    { path: '/', element: <LandingPage /> },
    { path: '/clientes', element: <ClientsLogin /> },
    { path: '/clientes/dashboard', element: <ProjectsList /> },
    { path: '/p/:slug', element: <ProjectLogin /> },
    { path: '/c/:slug/overview', element: <ProjectOverview /> },
    { path: '/operator', element: <OperatorPage /> },
    {
      path: '/app',
      element: <AppLayout />,
      children: [
        {
          index: true,
          element: (
            <ErrorBoundary
              title="No pudimos cargar el Dashboard"
              message="Se produjo un error al renderizar esta vista. Si persiste, revisa la integración de Search Console y vuelve a intentar."
            >
              <Dashboard
                modules={modules}
                globalScore={globalScore}
                onReset={resetCurrentProject}
              />
            </ErrorBoundary>
          ),
        },
        {
          path: 'module/:id',
          element: (
            <ModuleDetail
              modules={modules}
              onToggleTask={toggleTask}
              onAddTask={addTask}
              onDeleteTask={deleteTask}
              onUpdateTaskNotes={updateTaskNotes}
              onUpdateTaskImpact={updateTaskImpact}
              clientVertical={currentClient?.vertical || 'media'}
              clientName={currentClient?.name || 'Cliente'}
              onToggleCustomRoadmap={toggleCustomRoadmapTask}
              onToggleTaskCommunicated={toggleTaskCommunicated}
            />
          ),
        },
        {
          path: 'client-roadmap',
          element: (
            <ClientRoadmap
              modules={modules}
              customRoadmapOrder={currentClient?.customRoadmapOrder}
              onReorder={handleReorderRoadmap}
              onToggleTask={toggleTask}
              onRemoveFromRoadmap={toggleCustomRoadmapTask}
              onUpdateTaskNotes={updateTaskNotes}
              onUpdateTaskImpact={updateTaskImpact}
              clientVertical={currentClient?.vertical || 'media'}
              clientName={currentClient?.name || 'Cliente'}
              onToggleTaskCommunicated={toggleTaskCommunicated}
            />
          ),
        },
        { path: 'kanban', element: <KanbanBoard /> },
        { path: 'gantt', element: <GanttBoard /> },
        { path: 'checklist', element: <SeoChecklistPage /> },
        { path: 'ai-roadmap', element: <AIRoadmap /> },
        { path: 'ia-visibility', element: <Navigate to='/app/ai-roadmap' replace /> },
        { path: 'gsc-impact', element: <GscImpactPage /> },
        { path: 'clustering-site', element: <SiteClusteringPage /> },
        { path: 'cluster-workflow', element: <UnifiedClusterWorkflowPage /> },
        { path: 'gsc-impact/portfolio', element: <Navigate to='/app/gsc-impact?view=global' replace /> },
        { path: 'gsc-impact/portolio', element: <Navigate to='/app/gsc-impact?view=global' replace /> },
        { path: 'settings', element: <Settings /> },
        { path: 'trends-media', element: <TrendsMediaPage /> },
        { path: 'tools-hub', element: <ToolsHub /> },
        { path: 'admin/ideas', element: <AdminIdeasPage /> },
        {
          path: 'completed-tasks',
          element: (
            <CompletedTasks
              completedTasks={currentClient?.completedTasksLog || []}
              onAddManualTask={addManualCompletedTask}
              onDeleteLogEntry={deleteCompletedTaskLog}
              onUpdateImpact={updateCompletedTaskImpact}
              projectContext={{
                projectType: currentClient?.projectType || 'MEDIA',
                sector: currentClient?.sector || 'Otro',
                geoScope: currentClient?.geoScope || 'global',
              }}
            />
          ),
        },
        { path: '*', element: <Navigate to='/app' replace /> },
      ],
    },
    { path: '*', element: <Navigate to='/' replace /> },
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Spinner size={48} />
        </div>
      }
    >
      <ErrorBoundary
        title="No pudimos cargar la portada"
        message="Se produjo un error inesperado al cargar esta página. Recarga e inténtalo nuevamente en unos segundos."
      >
        <RouterProvider router={router} />
      </ErrorBoundary>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <SettingsProvider>
        <ProjectProvider>
          <AppRoutes />
        </ProjectProvider>
      </SettingsProvider>
    </ToastProvider>
  );
};

export default App;
