import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
const IAVisibility = lazy(() => import('./pages/IAVisibility'));
const GscImpactPage = lazy(() => import('./pages/GscImpactPage'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminIdeasPage = lazy(() => import('./pages/admin/AdminIdeasPage'));
const TrendsMediaPage = lazy(() => import('./pages/TrendsMediaPage'));
const ToolsHub = lazy(() => import('./pages/ToolsHub'));

const LandingPage = lazy(() => import('./pages/portal/LandingPage'));
const ClientsLogin = lazy(() => import('./pages/portal/ClientsLogin'));
const ProjectsList = lazy(() => import('./pages/portal/ProjectsList'));
const ProjectLogin = lazy(() => import('./pages/portal/ProjectLogin'));
const ProjectOverview = lazy(() => import('./pages/portal/ProjectOverview'));
const OperatorPage = lazy(() => import('./pages/portal/OperatorPage'));

const publicRoutes = (
  <>
    <Route path="/" element={<LandingPage />} />
    <Route path="/clientes" element={<ClientsLogin />} />
    <Route path="/clientes/dashboard" element={<ProjectsList />} />
    <Route path="/p/:slug" element={<ProjectLogin />} />
    <Route path="/c/:slug/overview" element={<ProjectOverview />} />
  </>
);

const operatorRoutes = <Route path="/operator" element={<OperatorPage />} />;

export const AppRoutes: React.FC = () => {
  const {
    modules,
    globalScore,
    clients,
    currentClientId,
    currentClient,
    generalNotes,
    switchClient,
    addClient,
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
  } = useProject();

  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Spinner size={48} />
        </div>
      }
    >
      <Routes>
        {/* 1) Rutas públicas */}
        {publicRoutes}

        {/* 2) Operador */}
        {operatorRoutes}

        {/* 3) Rutas internas */}
        <Route
          path="/app/*"
          element={
            <Layout
              modules={modules}
              globalScore={globalScore}
              clients={clients}
              currentClientId={currentClientId}
              onSwitchClient={switchClient}
              onAddClient={addClient}
              onDeleteClient={deleteClient}
              generalNotes={generalNotes}
              projectNotes={currentClient?.notes || []}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
            >
              <Routes>
                <Route
                  index
                  element={
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
                  }
                />
                <Route
                  path="module/:id"
                  element={
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
                  }
                />
                <Route
                  path="client-roadmap"
                  element={
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
                  }
                />
                <Route path="kanban" element={<KanbanBoard />} />
                <Route path="checklist" element={<SeoChecklistPage />} />
                <Route path="ai-roadmap" element={<AIRoadmap />} />
                <Route path="ia-visibility" element={<IAVisibility />} />
                <Route path="gsc-impact" element={<GscImpactPage />} />
                <Route path="gsc-impact/portfolio" element={<Navigate to="/app/gsc-impact?view=global" replace />} />
                <Route path="gsc-impact/portolio" element={<Navigate to="/app/gsc-impact?view=global" replace />} />
                <Route path="settings" element={<Settings />} />
                <Route path="trends-media" element={<TrendsMediaPage />} />
                <Route path="tools-hub" element={<ToolsHub />} />
                <Route path="admin/ideas" element={<AdminIdeasPage />} />
                <Route
                  path="completed-tasks"
                  element={
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
                  }
                />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Routes>
            </Layout>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <SettingsProvider>
        <ProjectProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </ProjectProvider>
      </SettingsProvider>
    </ToastProvider>
  );
};

export default App;
