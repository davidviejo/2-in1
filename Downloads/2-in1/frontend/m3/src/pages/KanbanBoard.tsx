import React, { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useProject } from '../context/ProjectContext';
import { Task } from '../types';
import BulkActionsModal from '../components/BulkActionsModal';
import TaskDetailModal from '../components/TaskDetailModal';
import {
  CheckCircle2,
  Circle,
  Clock,
  GripVertical,
  Plus,
  Trash2,
  Link as LinkIcon,
  User,
  FileText,
  Target,
  PlayCircle,
  Eye,
  UserCheck,
  MessageSquare,
  Layers,
  ExternalLink,
  Edit2,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEFAULT_KANBAN_COLUMNS } from '../config/kanban';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/ToastContext';
import { useTranslation } from 'react-i18next';

interface ConfirmState {
  title: string;
  message: string;
  onConfirm: () => void;
  isDestructive?: boolean;
}

const KanbanBoard: React.FC = () => {
  const { t } = useTranslation();
  const { successAction } = useToast();
  const {
    modules,
    addTasksBulk,
    updateTaskStatus,
    toggleTask,
    currentClient,
    addKanbanColumn,
    deleteKanbanColumn,
    updateTaskDetails,
    deleteTask,
  } = useProject();

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  // New task creation state
  const [isAddingTask, setIsAddingTask] = useState<{ columnId: string } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Task detail modal state
  const [selectedTask, setSelectedTask] = useState<{ task: Task; moduleId: number } | null>(null);

  const columns =
    currentClient?.kanbanColumns && currentClient.kanbanColumns.length > 0
      ? currentClient.kanbanColumns
      : DEFAULT_KANBAN_COLUMNS;

  const buildTaskKey = (moduleId: number, taskId: string) => `${moduleId}::${taskId}`;

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, { task: Task; moduleId: number }[]> = {};
    columns.forEach((col) => {
      grouped[col.id] = [];
    });

    // Ensure default keys exist in the grouping object
    // to prevent errors if a task has a status for a column that was deleted
    // or if a status doesn't match any column.

    modules.forEach((module) => {
      module.tasks.forEach((task) => {
        // Filter by Custom Roadmap
        if (!task.isInCustomRoadmap) return;

        const status = task.status || 'pending';
        if (grouped[status]) {
          grouped[status].push({ task, moduleId: module.id });
        } else {
          // Fallback: if status doesn't match any column, put in the first one
          const firstColId = columns[0]?.id || 'pending';
          if (!grouped[firstColId]) grouped[firstColId] = [];
          grouped[firstColId].push({ task, moduleId: module.id });
        }
      });
    });

    return grouped;
  }, [modules, columns]);

  const onDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStatus = destination.droppableId;

    const [moduleIdPart, ...taskIdParts] = String(draggableId).split('::');
    const foundModuleId = Number(moduleIdPart);
    const foundTaskId = taskIdParts.join('::');

    if (!Number.isNaN(foundModuleId) && foundTaskId) {
      updateTaskStatus(foundModuleId, foundTaskId, newStatus);
    }
  };

  const handleAddTask = (columnId: string) => {
    if (newTaskTitle.trim()) {
      // Find default custom module or fallback to first
      let targetModule = modules.find((m) => m.isCustom);
      if (!targetModule && modules.length > 0) targetModule = modules[modules.length - 1];

      if (targetModule) {
        const newTask = {
          moduleId: targetModule.id,
          title: newTaskTitle.trim(),
          description: `Nueva tarea creada en el tablero Kanban en la columna ${columns.find((c) => c.id === columnId)?.title || columnId}`,
          impact: 'Medium' as const,
          category: 'Kanban',
          status: columnId,
          isInRoadmap: true,
        };

        // We use addTasksBulk since it supports setting status and isInRoadmap directly
        addTasksBulk([newTask]);
      }
    }
    setNewTaskTitle('');
    setIsAddingTask(null);
  };

  const handleAddColumn = () => {
    if (newColumnTitle.trim()) {
      addKanbanColumn(newColumnTitle.trim());
      setNewColumnTitle('');
      setIsAddingColumn(false);
    }
  };

  const getColumnIcon = (id: string) => {
    switch (id) {
      case 'pending':
        return <Circle className="icon-tone-muted" size={18} />;
      case 'commitment':
        return <Target className="icon-tone-primary" size={18} />;
      case 'working-now':
        return <PlayCircle className="icon-tone-warning" size={18} />;
      case 'in-progress':
        return <Clock className="icon-tone-info" size={18} />;
      case 'internal-review':
        return <Eye className="icon-tone-primary" size={18} />;
      case 'client-review':
        return <UserCheck className="icon-tone-info" size={18} />;
      case 'client-feedback':
        return <MessageSquare className="icon-tone-warning" size={18} />;
      case 'completed':
        return <CheckCircle2 className="icon-tone-success" size={18} />;
      default:
        return <Circle className="icon-tone-muted" size={18} />;
    }
  };

  return (
    <div className="page-shell h-full flex flex-col">
      <ConfirmDialog
        isOpen={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={t('feedback.confirm.confirm_button')}
        cancelLabel={t('feedback.confirm.cancel_button')}
        onConfirm={() => {
          confirmState?.onConfirm();
          setConfirmState(null);
        }}
        onCancel={() => setConfirmState(null)}
        isDestructive={confirmState?.isDestructive ?? true}
      />
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="section-title mb-2">Tablero Kanban</h1>
          <p className="section-subtitle mt-0">Gestiona el flujo de trabajo de tu Roadmap.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsBulkModalOpen(true)} variant="primary">
            <Layers size={18} />
            <span className="hidden sm:inline">Acciones Masivas</span>
          </Button>

          {isAddingColumn ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
              <Input
                type="text"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Nombre de la columna"
                className="w-52"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
              />
              <Button onClick={handleAddColumn} size="sm">
                <Plus size={18} />
              </Button>
              <Button onClick={() => setIsAddingColumn(false)} variant="ghost" size="sm">
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsAddingColumn(true)} variant="secondary">
              <Plus size={18} />
              Nueva Columna
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full gap-3 pb-4">
            {columns.map((column) => (
              <div
                key={column.id}
                className="flex-1 flex min-w-[220px] max-h-[calc(100vh-200px)] flex-col rounded-brand-lg border border-border bg-surface-alt h-full"
              >
                <div className="p-4 border-b border-border flex items-center justify-between bg-surface rounded-t-xl group/col">
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    {getColumnIcon(column.id)}
                    {column.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" className="normal-case tracking-normal">
                      {tasksByStatus[column.id]?.length || 0}
                    </Badge>
                    {!DEFAULT_KANBAN_COLUMNS.some((c) => c.id === column.id) && (
                      <button
                        onClick={() => {
                          setConfirmState({
                            title: t('feedback.confirm.delete_column_title'),
                            message: t('feedback.confirm.delete_column_message'),
                            onConfirm: () => {
                              deleteKanbanColumn(column.id);
                              successAction(t('feedback.actions.delete_column'));
                            },
                          });
                        }}
                        className="opacity-0 group-hover/col:opacity-100 text-muted hover:text-danger transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 p-3 overflow-y-auto custom-scrollbar transition-colors flex flex-col ${
                        snapshot.isDraggingOver ? 'bg-primary-soft/40' : ''
                      }`}
                    >
                      {tasksByStatus[column.id]?.map((item, index) => {
                        const taskKey = buildTaskKey(item.moduleId, item.task.id);
                        return (
                          <Draggable key={taskKey} draggableId={taskKey} index={index}>
                            {(provided, snapshot) => (
                              <div
                                onClick={() => setSelectedTask(item)}
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`group mb-3 cursor-pointer rounded-lg border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/40 ${
                                  snapshot.isDragging
                                    ? 'rotate-1 shadow-xl ring-2 ring-primary'
                                    : ''
                                }`}
                              >
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <Link
                                  to={`/app/module/${item.moduleId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary transition-colors hover:bg-primary-soft/80"
                                  title={`Ir al Módulo ${item.moduleId}`}
                                >
                                  Módulo {item.moduleId}
                                  <ExternalLink size={10} />
                                </Link>
                                <div className="icon-tone-muted flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTask(item);
                                    }}
                                    className="p-1 transition-colors hover:text-primary"
                                    title="Editar detalles"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <div {...provided.dragHandleProps} className="cursor-grab">
                                    <GripVertical size={16} />
                                  </div>
                                </div>
                              </div>
                              <h4 className="mb-3 text-sm font-medium leading-snug text-foreground">
                                {item.task.title}
                              </h4>

                              {item.task.status === 'completed' && (
                                <div className="flex justify-end mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmState({
                                        title: t('feedback.confirm.delete_completed_task_title'),
                                        message: t('feedback.confirm.delete_completed_task_message'),
                                        onConfirm: () => {
                                          deleteTask(item.moduleId, item.task.id);
                                          successAction(t('feedback.actions.delete_completed_task'));
                                        },
                                      });
                                    }}
                                    className="icon-tone-muted p-1 transition-colors hover:text-danger"
                                    title="Eliminar tarea completada"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}

                              {/* Task Details Edit */}
                              <div className="mb-3 space-y-2 border-t border-border pt-3">
                                <div
                                  className="flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <User size={14} className="icon-tone-muted" />
                                  <input
                                    type="text"
                                    placeholder="Asignar a..."
                                    className="flex-1 border-b border-transparent bg-transparent py-0.5 text-xs text-muted placeholder:text-muted focus:border-primary/40 focus:outline-none"
                                    defaultValue={item.task.assignee || ''}
                                    onBlur={(e) =>
                                      updateTaskDetails(item.moduleId, item.task.id, {
                                        assignee: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div
                                  className="flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Calendar size={14} className="icon-tone-muted" />
                                  <input
                                    type="date"
                                    title="Fecha estimada"
                                    className="flex-1 cursor-pointer border-b border-transparent bg-transparent py-0.5 text-xs text-muted focus:border-primary/40 focus:outline-none"
                                    value={item.task.dueDate || ''}
                                    onChange={(e) =>
                                      updateTaskDetails(item.moduleId, item.task.id, {
                                        dueDate: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div
                                  className="flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <LinkIcon size={14} className="icon-tone-muted" />
                                  <input
                                    type="text"
                                    placeholder="Enlace externo..."
                                    className="flex-1 border-b border-transparent bg-transparent py-0.5 text-xs text-primary placeholder:text-muted focus:border-primary/40 focus:outline-none"
                                    defaultValue={item.task.externalLink || ''}
                                    onBlur={(e) =>
                                      updateTaskDetails(item.moduleId, item.task.id, {
                                        externalLink: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div
                                  className="flex items-start gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FileText size={14} className="icon-tone-muted mt-0.5" />
                                  <textarea
                                    placeholder="Notas adicionales..."
                                    className="flex-1 resize-none overflow-hidden border-b border-transparent bg-transparent py-0.5 text-xs text-muted placeholder:text-muted focus:border-primary/40 focus:outline-none"
                                    rows={1}
                                    defaultValue={item.task.userNotes || ''}
                                    onBlur={(e) =>
                                      updateTaskDetails(item.moduleId, item.task.id, {
                                        userNotes: e.target.value,
                                      })
                                    }
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = target.scrollHeight + 'px';
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                    item.task.impact === 'High'
                                      ? 'text-danger bg-danger-soft border-danger/20'
                                      : item.task.impact === 'Medium'
                                        ? 'text-warning bg-warning-soft border-warning/20'
                                        : 'text-muted bg-surface-alt border-border'
                                  }`}
                                >
                                  {item.task.impact}
                                </span>
                              </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}

                      {/* Add Task Button/Input at bottom of column */}
                      <div className="mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
                        {isAddingTask?.columnId === column.id ? (
                          <div className="rounded-lg border border-primary/40 bg-surface p-3 shadow-sm">
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              placeholder="Título de la tarea..."
                              className="mb-2 w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddTask(column.id);
                                if (e.key === 'Escape') setIsAddingTask(null);
                              }}
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setIsAddingTask(null)}
                                className="text-xs text-muted hover:text-foreground"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleAddTask(column.id)}
                                className="rounded bg-primary px-2 py-1 text-xs text-on-primary hover:bg-primary-hover"
                              >
                                Añadir
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setIsAddingTask({ columnId: column.id });
                              setNewTaskTitle('');
                            }}
                            className="group flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm text-muted transition-colors hover:bg-primary-soft hover:text-primary"
                          >
                            <Plus
                              size={16}
                              className="icon-tone-muted group-hover:text-primary"
                            />
                            Añadir tarjeta
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      <BulkActionsModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} />

      <TaskDetailModal
        isOpen={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        task={selectedTask?.task || null}
        moduleId={selectedTask?.moduleId || null}
        onUpdateTaskDetails={updateTaskDetails}
        onToggleTask={toggleTask}
      />
    </div>
  );
};

export default KanbanBoard;
