import { normalizeCountry, normalizeLanguage, safeTrim } from '@/lib/filters/normalization';

export type ProjectSettingsInput = {
  name?: unknown;
  primaryDomain?: unknown;
  description?: unknown;
  mainCountry?: unknown;
  mainLanguage?: unknown;
  isActive?: unknown;
  chartColor?: unknown;
  notes?: unknown;
};

export type ProjectSettingsValues = {
  name: string;
  primaryDomain: string;
  description: string | null;
  mainCountry: string;
  mainLanguage: string;
  isActive: boolean;
  chartColor: string;
  notes: string | null;
};

export type CompetitorInput = {
  name?: unknown;
  domain?: unknown;
  aliases?: unknown;
  isActive?: unknown;
  chartColor?: unknown;
};

export type CompetitorValues = {
  name: string;
  domain: string;
  aliases: string[];
  isActive: boolean;
  chartColor: string;
};

export type TagInput = {
  name?: unknown;
  description?: unknown;
};

export type TagValues = {
  name: string;
  normalizedName: string;
  description: string | null;
};

export type PromptInput = {
  promptText?: unknown;
  country?: unknown;
  language?: unknown;
  isActive?: unknown;
  priority?: unknown;
  notes?: unknown;
  tagIds?: unknown;
  intentClassification?: unknown;
};

export type PromptValues = {
  promptText: string;
  country: string;
  language: string;
  isActive: boolean;
  priority: number;
  notes: string | null;
  tagIds: string[];
  intentClassification: string | null;
};

const DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

function readString(value: unknown): string {
  return safeTrim(value);
}

export function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeAliases(rawAliases: unknown): { aliases: string[]; normalizedAliases: string[] } {
  const parsed = Array.isArray(rawAliases)
    ? rawAliases
    : typeof rawAliases === 'string'
      ? rawAliases.split(',')
      : [];

  const aliases = parsed
    .map((alias) => readString(alias))
    .filter(Boolean)
    .slice(0, 20);

  const normalizedAliases = Array.from(new Set(aliases.map(normalizeAlias)));

  return {
    aliases: Array.from(new Set(aliases)),
    normalizedAliases
  };
}

export function validateAliasInput(rawAlias: unknown): { alias?: string; normalizedAlias?: string; error?: string } {
  const alias = readString(rawAlias);

  if (!alias) {
    return { error: 'Alias is required.' };
  }

  if (alias.length > 120) {
    return { error: 'Alias must be 120 characters or fewer.' };
  }

  return { alias, normalizedAlias: normalizeAlias(alias) };
}

export function validateCompetitorInput(input: CompetitorInput): {
  values?: CompetitorValues;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const name = readString(input.name);
  if (!name) {
    errors.name = 'Competitor name is required.';
  } else if (name.length > 120) {
    errors.name = 'Competitor name must be 120 characters or fewer.';
  }

  const domain = readString(input.domain).toLowerCase();
  if (!domain) {
    errors.domain = 'Domain is required.';
  } else if (!DOMAIN_REGEX.test(domain)) {
    errors.domain = 'Domain must be a valid domain (e.g. competitor.com).';
  }

  const chartColor = readString(input.chartColor);
  if (!chartColor) {
    errors.chartColor = 'Chart color is required.';
  } else if (!HEX_COLOR_REGEX.test(chartColor)) {
    errors.chartColor = 'Chart color must be a valid HEX value.';
  }

  const { aliases, normalizedAliases } = normalizeAliases(input.aliases);

  if (aliases.some((alias) => alias.length > 120)) {
    errors.aliases = 'Each alias must be 120 characters or fewer.';
  }

  if (normalizedAliases.length > 20) {
    errors.aliases = 'A maximum of 20 aliases is allowed.';
  }

  const isActive =
    typeof input.isActive === 'boolean'
      ? input.isActive
      : input.isActive === 'true'
        ? true
        : input.isActive === 'false'
          ? false
          : true;

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      name,
      domain,
      aliases,
      isActive,
      chartColor
    }
  };
}

export function validateTagInput(input: TagInput): {
  values?: TagValues;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const name = readString(input.name);
  const description = readString(input.description);

  if (!name) {
    errors.name = 'Tag name is required.';
  } else if (name.length > 80) {
    errors.name = 'Tag name must be 80 characters or fewer.';
  }

  if (description.length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      name,
      normalizedName: normalizeTagName(name),
      description: description || null
    }
  };
}

export function validatePromptInput(input: PromptInput): {
  values?: PromptValues;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const promptText = readString(input.promptText);
  const country = normalizeCountry(input.country) ?? '';
  const language = normalizeLanguage(input.language) ?? 'es';
  const notes = readString(input.notes);
  const intentClassification = readString(input.intentClassification);
  const parsedPriority =
    typeof input.priority === 'number'
      ? input.priority
      : typeof input.priority === 'string'
        ? Number.parseInt(input.priority, 10)
        : Number.NaN;
  const isActive =
    typeof input.isActive === 'boolean'
      ? input.isActive
      : input.isActive === 'true'
        ? true
        : input.isActive === 'false'
          ? false
          : true;

  if (!promptText) {
    errors.promptText = 'Prompt text is required.';
  } else if (promptText.length > 8000) {
    errors.promptText = 'Prompt text must be 8000 characters or fewer.';
  }

  if (!country) {
    errors.country = 'Country is required.';
  } else if (!normalizeCountry(country)) {
    errors.country = 'Country must be a 2-letter ISO code (e.g. US, ES).';
  }

  if (!normalizeLanguage(language)) {
    errors.language = 'Language must be a language code (e.g. en or es-mx).';
  }

  if (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 999) {
    errors.priority = 'Priority must be an integer between 1 and 999.';
  }

  if (notes.length > 1000) {
    errors.notes = 'Notes must be 1000 characters or fewer.';
  }

  if (intentClassification.length > 120) {
    errors.intentClassification = 'Intent classification must be 120 characters or fewer.';
  }

  const tagIds = Array.isArray(input.tagIds)
    ? input.tagIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];

  if (tagIds.length > 30) {
    errors.tagIds = 'A maximum of 30 tags per prompt is allowed.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      promptText,
      country,
      language,
      isActive,
      priority: parsedPriority,
      notes: notes || null,
      tagIds: Array.from(new Set(tagIds)),
      intentClassification: intentClassification || null
    }
  };
}

export function validateProjectSettings(input: ProjectSettingsInput): {
  values?: ProjectSettingsValues;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const name = readString(input.name);
  if (!name) {
    errors.name = 'Project name is required.';
  } else if (name.length > 120) {
    errors.name = 'Project name must be 120 characters or fewer.';
  }

  const primaryDomain = readString(input.primaryDomain).toLowerCase();
  if (!primaryDomain) {
    errors.primaryDomain = 'Primary domain is required.';
  } else if (!DOMAIN_REGEX.test(primaryDomain)) {
    errors.primaryDomain = 'Primary domain must be a valid domain (e.g. example.com).';
  }

  const mainCountry = normalizeCountry(input.mainCountry) ?? '';
  if (!mainCountry) {
    errors.mainCountry = 'Main country is required.';
  } else if (!normalizeCountry(mainCountry)) {
    errors.mainCountry = 'Main country must use ISO 3166-1 alpha-2 format (e.g. US).';
  }

  const mainLanguage = normalizeLanguage(input.mainLanguage) ?? '';
  if (!mainLanguage) {
    errors.mainLanguage = 'Main language is required.';
  } else if (!normalizeLanguage(mainLanguage)) {
    errors.mainLanguage = 'Main language must be a language code (e.g. en or es-mx).';
  }

  const chartColor = readString(input.chartColor);
  if (!chartColor) {
    errors.chartColor = 'Chart color is required.';
  } else if (!HEX_COLOR_REGEX.test(chartColor)) {
    errors.chartColor = 'Chart color must be a valid HEX value.';
  }

  const isActive =
    typeof input.isActive === 'boolean'
      ? input.isActive
      : input.isActive === 'true'
        ? true
        : input.isActive === 'false'
          ? false
          : true;

  const description = readString(input.description);
  const notes = readString(input.notes);

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      name,
      primaryDomain,
      description: description || null,
      mainCountry,
      mainLanguage,
      isActive,
      chartColor,
      notes: notes || null
    }
  };
}
