import { ModuleData, Task, ClientVertical } from '../types';
import {
  MEDIA_MODULES,
  ECOMMERCE_MODULES,
  LOCAL_MODULES,
  NATIONAL_MODULES,
  INTERNATIONAL_MODULES,
  INITIAL_MODULES,
} from '../constants';

export interface SeoStrategy {
  getVerticalName(): ClientVertical;
  getModules(): ModuleData[];
  getInitialTasks(): Task[];
}

export class MediaStrategy implements SeoStrategy {
  getVerticalName(): ClientVertical {
    return 'media';
  }

  getModules(): ModuleData[] {
    return JSON.parse(JSON.stringify(MEDIA_MODULES));
  }

  getInitialTasks(): Task[] {
    return this.getModules().flatMap((m) => m.tasks);
  }
}

export class EcomStrategy implements SeoStrategy {
  getVerticalName(): ClientVertical {
    return 'ecom';
  }

  getModules(): ModuleData[] {
    return JSON.parse(JSON.stringify(ECOMMERCE_MODULES));
  }

  getInitialTasks(): Task[] {
    return this.getModules().flatMap((m) => m.tasks);
  }
}

export class LocalStrategy implements SeoStrategy {
  getVerticalName(): ClientVertical {
    return 'local';
  }

  getModules(): ModuleData[] {
    return JSON.parse(JSON.stringify(LOCAL_MODULES));
  }

  getInitialTasks(): Task[] {
    return this.getModules().flatMap((m) => m.tasks);
  }
}

export class NationalStrategy implements SeoStrategy {
  getVerticalName(): ClientVertical {
    return 'national';
  }

  getModules(): ModuleData[] {
    return JSON.parse(JSON.stringify(NATIONAL_MODULES));
  }

  getInitialTasks(): Task[] {
    return this.getModules().flatMap((m) => m.tasks);
  }
}

export class InternationalStrategy implements SeoStrategy {
  getVerticalName(): ClientVertical {
    return 'international';
  }

  getModules(): ModuleData[] {
    return JSON.parse(JSON.stringify(INTERNATIONAL_MODULES));
  }

  getInitialTasks(): Task[] {
    return this.getModules().flatMap((m) => m.tasks);
  }
}

export class StrategyFactory {
  static getStrategy(vertical: ClientVertical): SeoStrategy {
    switch (vertical) {
      case 'ecom':
        return new EcomStrategy();
      case 'local':
        return new LocalStrategy();
      case 'national':
        return new NationalStrategy();
      case 'international':
        return new InternationalStrategy();
      case 'media':
      default:
        return new MediaStrategy();
    }
  }
}
