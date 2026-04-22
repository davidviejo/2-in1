import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('./httpClient', () => ({
  createHttpClient: () => ({
    get: getMock,
  }),
}));

vi.mock('./endpoints', () => ({
  endpoints: {
    templates: {
      catalog: () => '/templates/catalog',
    },
  },
}));

describe('TemplateService', () => {
  beforeEach(() => {
    getMock.mockReset();
    vi.resetModules();
  });

  it('completa los módulos remotos incompletos con la plantilla local', async () => {
    const { MEDIA_MODULES } = await import('../constants');

    getMock.mockResolvedValue({
      version: 'remote-v1',
      templates: {
        media: {
          vertical: 'media',
          version: 'remote-v1',
          modules: [
            {
              id: 1,
              title: 'M1 parcial',
              subtitle: '',
              levelRange: '0-20',
              description: '',
              iconName: 'Search',
              tasks: [],
            },
            {
              id: 9,
              title: 'MIA remoto',
              subtitle: '',
              levelRange: 'N/A',
              description: '',
              iconName: 'Bot',
              tasks: [],
            },
          ],
        },
      },
    });

    const { TemplateService } = await import('./templateService');

    await TemplateService.prime();
    const template = TemplateService.getTemplate('media');

    expect(template.source).toBe('remote');
    expect(template.version).toBe('remote-v1');
    expect(template.modules.map((module) => module.id)).toEqual(MEDIA_MODULES.map((module) => module.id));
  });
});
