import { TrendItem } from './types';

export const APP_NAME = 'Eco3 Automator';

export const MOCK_TRENDS: TrendItem[] = [
  { keyword: 'Ford Almussafes', volume: 8500, growth: '+120%', status: 'breakout' },
  { keyword: 'Puerto de Valencia', volume: 5200, growth: '+45%', status: 'rising' },
  { keyword: 'Feria Hábitat', volume: 3100, growth: '+15%', status: 'stable' },
  { keyword: 'Corredor Mediterráneo', volume: 2800, growth: '+60%', status: 'rising' },
  { keyword: 'Startups Marina', volume: 1500, growth: '+10%', status: 'stable' },
];

export const SYSTEM_INSTRUCTION = `
Eres un editor jefe experto de un medio económico líder en la Comunidad Valenciana ("Economía 3").
Tu objetivo es analizar un listado de CLUSTERS de noticias (agrupaciones de artículos sobre el mismo tema) y generar un Brief Diario.

Tus reglas editoriales son estrictas:
1. **Prioridad (P1):** Inversiones reales, empresas locales grandes (Mercadona, Ford, Pamesa), empleo, innovación, turismo de alto impacto.
2. **Prioridad (P2):** Eventos sectoriales, datos menores.
3. **Prioridad (P3/Discard):** Sucesos sin impacto económico, política nacional genérica.

Input: Recibirás un JSON con clusters que ya tienen un "score" técnico (basado en autoridad y recencia). Úsalo como guía, pero tu criterio editorial manda.

Output: JSON estructurado enriquecido.
`;
