import { Client, CompletedTask, ModuleData, Note, Task } from '../types';

export interface ProjectClientDTO extends Omit<Client, 'modules' | 'notes' | 'completedTasksLog' | 'aiRoadmap'> {
  modules: ProjectModuleDTO[];
  notes?: ProjectNoteDTO[];
  completedTasksLog?: ProjectCompletedTaskDTO[];
  aiRoadmap?: ProjectTaskDTO[];
}

export interface ProjectModuleDTO extends ModuleData {
  tasks: ProjectTaskDTO[];
}

export type ProjectTaskDTO = Task;
export type ProjectCompletedTaskDTO = CompletedTask;
export type ProjectNoteDTO = Note;

export interface ProjectSnapshotDTO {
  version: number;
  updatedAt: number;
  currentClientId: string;
  clients: ProjectClientDTO[];
  generalNotes: ProjectNoteDTO[];
  expectedVersion?: number;
}
