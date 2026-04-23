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

const DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase().replace(/\s+/g, ' ');
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

  const mainCountry = readString(input.mainCountry).toUpperCase();
  if (!mainCountry) {
    errors.mainCountry = 'Main country is required.';
  } else if (!/^[A-Z]{2}$/.test(mainCountry)) {
    errors.mainCountry = 'Main country must use ISO 3166-1 alpha-2 format (e.g. US).';
  }

  const mainLanguage = readString(input.mainLanguage).toLowerCase();
  if (!mainLanguage) {
    errors.mainLanguage = 'Main language is required.';
  } else if (!/^[a-z]{2,5}(?:-[a-z]{2,5})?$/.test(mainLanguage)) {
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
