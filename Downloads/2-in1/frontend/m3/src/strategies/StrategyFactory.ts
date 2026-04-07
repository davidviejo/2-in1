import { ModuleData, Task, ClientVertical } from '../types';
import { TemplateService } from '../services/templateService';

export interface SeoStrategy {
  getVerticalName(): ClientVertical;
  getModules(): ModuleData[];
  getInitialTasks(): Task[];
  getTemplateVersion(): string;
}

class BaseStrategy implements SeoStrategy {
  constructor(private readonly vertical: ClientVertical) {}

  getVerticalName(): ClientVertical {
    return this.vertical;
  }

  getModules(): ModuleData[] {
    return TemplateService.getTemplate(this.vertical).modules;
  }

  getInitialTasks(): Task[] {
    return this.getModules().flatMap((m) => m.tasks);
  }

  getTemplateVersion(): string {
    return TemplateService.getTemplate(this.vertical).version;
  }
}

export class StrategyFactory {
  static async primeTemplates(): Promise<void> {
    await TemplateService.prime();
  }

  static getStrategy(vertical: ClientVertical): SeoStrategy {
    return new BaseStrategy(vertical);
  }
}
