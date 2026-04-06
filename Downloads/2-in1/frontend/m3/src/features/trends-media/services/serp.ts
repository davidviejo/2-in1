import { AppSettings, NewsArticle } from '../types';
import { SettingsRepository } from '../../../services/settingsRepository';

const SERP_API_BASE = 'https://serpapi.com/search.json';

const normalizeSerpResponse = (data: any, keyword: string): NewsArticle[] => {
  const normalized: NewsArticle[] = [];
  const items = data.news_results || [];

  items.forEach((item: any, index: number) => {
    if (item.stories && Array.isArray(item.stories)) {
      item.stories.forEach((story: any) => {
        normalized.push({
          article_id: '',
          title: story.title,
          url: story.link,
          source_name: story.source?.name || story.source || 'Desconocido',
          published_at: story.date || new Date().toISOString(),
          thumbnail_url: item.thumbnail || undefined,
          position: index + 1,
          keyword,
          snippet: item.snippet || '',
        });
      });
    }

    normalized.push({
      article_id: '',
      title: item.title,
      url: item.link,
      source_name: item.source?.name || item.source || 'Desconocido',
      published_at: item.date || new Date().toISOString(),
      thumbnail_url: item.thumbnail,
      position: index + 1,
      keyword,
      snippet: item.snippet || '',
    });
  });

  return normalized.filter((article) => article.title && article.url);
};

export const fetchSerpResults = async (settings: AppSettings): Promise<NewsArticle[]> => {
  const appSettings = SettingsRepository.getSettings();
  const serpProvider = appSettings.defaultSerpProvider || 'dataforseo';
  const serpApiKey = appSettings.serpApiKey;

  if (serpProvider !== 'serpapi') {
    console.warn('Default SERP provider is not SerpApi. Returning expanded mock data for trends-media.');
    return MOCK_GOOGLE_NEWS_RESPONSE;
  }

  if (!serpApiKey) {
    console.warn('No global SerpApi Key provided. Returning expanded mock data.');
    return MOCK_GOOGLE_NEWS_RESPONSE;
  }

  const allArticles: NewsArticle[] = [];
  let hasNetworkError = false;

  const fetchQuery = async (query: string): Promise<NewsArticle[]> => {
    const url = new URL(SERP_API_BASE);
    url.searchParams.append('engine', 'google_news');
    url.searchParams.append('q', query);
    url.searchParams.append('api_key', serpApiKey);
    url.searchParams.append('gl', 'es');
    url.searchParams.append('hl', 'es');
    url.searchParams.append('num', '100');

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        console.warn(`SerpApi HTTP Error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (data.error) {
        console.warn(`SerpApi API Error: ${data.error}`);
        return [];
      }

      return normalizeSerpResponse(data, query);
    } catch (error) {
      console.error('SERP Network Error (Likely CORS issue):', error);
      hasNetworkError = true;
      return [];
    }
  };

  const resultsArray = await Promise.all(settings.searchQueries.map((query) => fetchQuery(query)));
  resultsArray.forEach((result) => allArticles.push(...result));

  if (allArticles.length === 0 && hasNetworkError) {
    console.warn('Falling back to mock data due to network/CORS errors with SerpApi.');
    return MOCK_GOOGLE_NEWS_RESPONSE;
  }

  return allArticles;
};

const MOCK_GOOGLE_NEWS_RESPONSE: NewsArticle[] = [
  {
    article_id: 'mock1',
    title: 'Ford Almussafes pacta el ERE con UGT: 600 salidas voluntarias',
    url: 'https://valenciaplaza.com/ford-almussafes-ere-acuerdo',
    source_name: 'Valencia Plaza',
    published_at: 'Hace 2 horas',
    position: 1,
    keyword: 'valencia economia',
    thumbnail_url: 'https://placehold.co/100x100/png',
    snippet: 'La dirección y el sindicato mayoritario alcanzan un preacuerdo para el expediente de regulación de empleo.',
  },
  {
    article_id: 'mock2',
    title: 'El Puerto de Valencia supera el tráfico de contenedores de 2023',
    url: 'https://economia3.com/puerto-valencia-trafico',
    source_name: 'Economía 3',
    published_at: 'Hace 4 horas',
    position: 2,
    keyword: 'puerto valencia',
    snippet: 'Crecimiento del 5% interanual impulsado por exportaciones del sector cerámico y automovilístico.',
  },
  {
    article_id: 'mock3',
    title: 'Roig Arena: así avanzan las obras del mayor pabellón de España',
    url: 'https://lasprovincias.es/roig-arena-obras',
    source_name: 'Las Provincias',
    published_at: 'Hace 5 horas',
    position: 3,
    keyword: 'eventos valencia',
    snippet: 'El proyecto encara su recta final con la instalación de la cubierta principal.',
  },
  {
    article_id: 'mock4',
    title: 'PowerCo inicia la contratación de 500 ingenieros en Sagunto',
    url: 'https://levante-emv.com/powerco-empleo',
    source_name: 'Levante-EMV',
    published_at: 'Hace 6 horas',
    position: 4,
    keyword: 'valencia empresas',
    snippet: 'La gigafactoría de baterías de Volkswagen acelera su puesta en marcha.',
  },
  {
    article_id: 'mock5',
    title: 'Mercadona sube sueldo a la plantilla un 3% por encima del IPC',
    url: 'https://expansion.com/mercadona-sueldos',
    source_name: 'Expansión',
    published_at: 'Hace 8 horas',
    position: 5,
    keyword: 'valencia economia',
    snippet: 'Juan Roig anuncia medidas para mantener el poder adquisitivo de los trabajadores.',
  },
  {
    article_id: 'mock6',
    title: 'Feria Hábitat Valencia cierra con récord de asistencia internacional',
    url: 'https://valenciaplaza.com/habitat-record',
    source_name: 'Valencia Plaza',
    published_at: 'Hace 12 horas',
    position: 6,
    keyword: 'feria valencia',
    snippet: 'Más de 45.000 profesionales visitaron el certamen del mueble e iluminación.',
  },
  {
    article_id: 'mock7',
    title: 'Lanzadera acoge a 100 nuevas startups en su convocatoria de enero',
    url: 'https://valenciaplaza.com/lanzadera-nuevas-startups',
    source_name: 'Valencia Plaza',
    published_at: 'Hace 14 horas',
    position: 7,
    keyword: 'startups valencia',
    snippet: 'La aceleradora de Marina de Empresas impulsa proyectos de IA y salud.',
  },
  {
    article_id: 'mock8',
    title: 'El Turismo en la Comunitat prevé un verano histórico en ocupación',
    url: 'https://elmundo.es/turismo-valencia',
    source_name: 'El Mundo',
    published_at: 'Hace 1 día',
    position: 8,
    keyword: 'turismo valencia',
    snippet: 'Las reservas hoteleras superan ya el 85% para los meses de julio y agosto.',
  },
  {
    article_id: 'mock9',
    title: 'Nuevas líneas de metro para conectar el área metropolitana',
    url: 'https://lasprovincias.es/metro-valencia-ampliacion',
    source_name: 'Las Provincias',
    published_at: 'Hace 1 día',
    position: 9,
    keyword: 'movilidad valencia',
    snippet: 'La Generalitat presenta el plan de expansión de Metrovalencia para 2030.',
  },
  {
    article_id: 'mock10',
    title: 'El sector cerámico de Castellón pide ayudas por los costes del gas',
    url: 'https://mediterraneo.com/ceramica-crisis',
    source_name: 'El Periódico Mediterráneo',
    published_at: 'Hace 2 días',
    position: 10,
    keyword: 'valencia economia',
    snippet: 'La patronal ASCER advierte de posibles paros si no se reducen los costes energéticos.',
  },
  {
    article_id: 'mock11',
    title: 'Valencia Capital Verde Europea: agenda de eventos para la semana',
    url: 'https://visitvalencia.com/agenda-verde',
    source_name: 'Visit Valencia',
    published_at: 'Hace 3 horas',
    position: 11,
    keyword: 'eventos valencia',
    snippet: 'Conciertos, charlas y rutas sostenibles llenan la agenda de la capital.',
  },
  {
    article_id: 'mock12',
    title: 'Resultados financieros de CaixaBank: beneficio récord en la C. Valenciana',
    url: 'https://cinco-dias.com/caixabank-resultados',
    source_name: 'Cinco Días',
    published_at: 'Hace 5 horas',
    position: 12,
    keyword: 'valencia economia',
    snippet: 'La entidad consolida su liderazgo en la región tras la fusión.',
  },
  {
    article_id: 'mock13',
    title: 'Incendio en una nave industrial de Paterna sin heridos',
    url: 'https://levante-emv.com/sucesos-paterna',
    source_name: 'Levante-EMV',
    published_at: 'Hace 1 hora',
    position: 13,
    keyword: 'valencia noticias',
    snippet: 'Los bomberos controlan el fuego que afectó a una empresa de plásticos.',
  },
  {
    article_id: 'mock14',
    title: 'El Ayuntamiento aprueba los presupuestos con más inversión social',
    url: 'https://valencia.es/noticias-presupuestos',
    source_name: 'Ayuntamiento Valencia',
    published_at: 'Hace 20 horas',
    position: 14,
    keyword: 'valencia noticias',
    snippet: 'Las cuentas municipales crecen un 4% respecto al año anterior.',
  },
];
