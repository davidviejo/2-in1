import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Linkedin, Twitter, Globe, CheckCircle, FolderOpen, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { useProject } from '../../context/ProjectContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PortalShell } from '../../components/shell/ShellVariants';

interface DisplayClient {
  slug: string;
  name: string;
  status: string;
  description: string;
  isLocal?: boolean;
}

const experienceItems = [
  {
    title: 'Consultor SEO Senior',
    company: 'agenciaSEO.eu',
    period: 'sept. 2024 - actualidad • Remoto',
    description:
      'Consultoría SEO especializada en auditorías técnicas, arquitectura de sitios y estrategia de posicionamiento para grandes cuentas de e-commerce y servicios.',
  },
  {
    title: 'Consultor SEO Freelance',
    company: 'David Viejo',
    period: 'dic. 2020 - actualidad • Zaragoza',
    description:
      'Gestión integral de estrategia SEO para clientes propios. Diseño web optimizado, linkbuilding y optimización de ROI.',
  },
  {
    title: 'Head of SEO',
    company: 'BirdCom',
    period: 'oct. 2023 - sept. 2024 • Zaragoza',
    description:
      'Liderazgo de equipo SEO (7 personas). Gestión de proyectos de alto ticket, formación interna y desarrollo de roadmap estratégico.',
  },
  {
    title: 'Consultor SEO Manager',
    company: 'BirdCom',
    period: 'ene. 2022 - oct. 2023 • Zaragoza',
    description:
      'Gestión simultánea de hasta 13 proyectos. Implementación de IA en procesos SEO y alta retención de clientes.',
  },
  {
    title: 'Especialista SEO',
    company: 'BirdCom',
    period: 'feb. 2021 - ene. 2022 • Zaragoza',
    description:
      'Ejecución de estrategias SEO, auditorías técnicas y campañas de linkbuilding como primer integrante del departamento.',
  },
  {
    title: 'SEO & CM',
    company: 'Óptima Web',
    period: 'jul. 2020 - dic. 2020 • Zaragoza',
    description:
      'Prácticas de máster enfocadas en estrategias SEO, diseño web y gestión de redes sociales.',
  },
];

const certifications = ['Google Certified', 'HubSpot Certified', 'SEO Técnico Avanzado'];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { clients: localProjects, switchClient } = useProject();

  const {
    data: publicProjects = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<DisplayClient[]>({
    queryKey: ['public-clients'],
    queryFn: () => api.getPublicClients(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const mappedLocalProjects = useMemo(
    () =>
      localProjects.map((project) => ({
        slug: project.id,
        name: project.name,
        status: 'active',
        description: `Proyecto (${project.vertical}) - Creado el ${new Date(project.createdAt).toLocaleDateString()}`,
        isLocal: true,
      })),
    [localProjects],
  );

  const combinedClients = useMemo(() => {
    const deduped = new Map<string, DisplayClient>();
    [...mappedLocalProjects, ...publicProjects].forEach((client) => {
      if (!deduped.has(client.slug) || client.isLocal) {
        deduped.set(client.slug, client);
      }
    });
    return Array.from(deduped.values());
  }, [mappedLocalProjects, publicProjects]);

  const statusSummary = useMemo(
    () => ({
      total: combinedClients.length,
      active: combinedClients.filter((client) => client.status === 'active').length,
      local: combinedClients.filter((client) => client.isLocal).length,
    }),
    [combinedClients],
  );

  const handleAccess = (client: DisplayClient) => {
    if (client.isLocal) {
      switchClient(client.slug);
      navigate('/app/');
      return;
    }

    navigate(`/p/${client.slug}`);
  };

  return (
    <PortalShell
      header={
        <nav className="w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rotate-45 transform bg-orange-500"></div>
              <span className="text-xl font-bold tracking-tight text-slate-900">agenciaSEO.eu</span>
            </div>

            <div className="flex items-center space-x-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <a href="#experience" className="transition-colors hover:text-orange-500">
                Experiencia
              </a>
              <a href="#projects" className="transition-colors hover:text-orange-500">
                Proyectos
              </a>
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-green-500">Disponible</span>
              </div>
            </div>
          </div>
        </nav>
      }
      contentClassName="w-full text-slate-800 selection:bg-orange-500 selection:text-white"
    >

      <section className="mx-auto flex max-w-7xl flex-col gap-12 px-4 pb-20 pt-40 sm:px-6 lg:flex-row lg:px-8">
        <div className="flex-shrink-0">
          <div className="relative overflow-hidden rounded-full border-4 border-orange-100 bg-white p-2 shadow-lg">
            <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-4xl font-bold text-slate-400 md:h-64 md:w-64">
              <span className="uppercase">DV</span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 pt-4">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-blue-900 md:text-5xl">
              David Viejo
            </h1>
            <p className="mt-1 text-lg font-medium text-orange-500">
              Consultor SEO — agenciaSEO.eu
            </p>
          </div>

          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Consultor SEO con experiencia en pymes y grandes internacionales.
            <br />
            Lidero la visibilidad orgánica y el posicionamiento SEO de grandes marcas y emergentes
            aportando valor.
          </p>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            <Card className="px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Proyectos
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{statusSummary.total}</div>
            </Card>
            <Card className="px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Activos
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">{statusSummary.active}</div>
            </Card>
            <Card className="px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Locales
              </div>
              <div className="mt-1 text-2xl font-bold text-blue-700">{statusSummary.local}</div>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {[
              'SEO Técnico',
              'Arquitectura Web',
              'SEM',
              'Web Analytics',
              'E-commerce',
              'Link Building',
              'Content Strategy',
            ].map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              >
                {skill}
              </span>
            ))}
          </div>

          <div className="flex items-center space-x-3 pt-4">
            <a
              href="https://www.linkedin.com/in/david-viejo/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Linkedin className="mr-2 h-4 w-4 text-[#0A66C2]" /> LinkedIn
            </a>
            <a
              href="#"
              className="flex items-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Twitter className="mr-2 h-4 w-4 text-slate-800" /> @DavidViejoSEO
            </a>
            <a
              href="https://agenciaseo.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Globe className="mr-2 h-4 w-4 text-blue-600" /> agenciaSEO.eu
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto my-8 h-px w-full max-w-7xl bg-slate-200"></div>

      <section id="experience" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-sm font-bold uppercase tracking-wider text-slate-400">
          Trayectoria Profesional
        </h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {experienceItems.map((item) => (
            <div
              key={`${item.company}-${item.title}`}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="text-lg font-bold text-slate-800">{item.title}</h3>
              <p className="mb-1 text-sm font-medium text-orange-500">{item.company}</p>
              <p className="mb-4 text-xs text-slate-400">{item.period}</p>
              <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto my-8 h-px w-full max-w-7xl bg-slate-200"></div>

      <section id="projects" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Proyectos activos — área de clientes
            </h2>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              Acceso unificado a proyectos locales y remotos
            </p>
            <p className="mt-2 max-w-2xl text-slate-600">
              La vista mezcla proyectos del backend público y proyectos guardados localmente para
              reducir pasos, evitar duplicados y acelerar el acceso al panel.
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            variant="secondary"
            className="border-slate-200 text-slate-700 hover:border-orange-200 hover:text-orange-600"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar listado
          </Button>
        </div>

        {isLoading ? (
          <EmptyState
            title="Cargando proyectos..."
            icon={<Spinner size={26} className="mr-1" />}
          />
        ) : isError ? (
          <EmptyState
            className="border-rose-200 bg-rose-50 text-rose-700"
            title="No se pudo sincronizar el listado remoto."
            description="Puedes seguir entrando a tus proyectos locales y reintentar la sincronización."
          />
        ) : combinedClients.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-12 w-12 text-slate-300" />}
            title="No hay proyectos activos visibles."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {combinedClients.map((client) => (
              <button
                key={client.slug}
                type="button"
                onClick={() => handleAccess(client)}
                className="group rounded-brand-lg border border-border bg-surface p-5 text-left shadow-card transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {client.isLocal ? (
                        <FolderOpen className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      {client.isLocal ? 'Local' : 'Remoto'}
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-orange-600">
                      {client.name}
                    </h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {client.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{client.description}</p>
                <div className="mt-4 text-sm font-semibold text-blue-700">Abrir proyecto →</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="mx-auto my-8 h-px w-full max-w-7xl bg-slate-200"></div>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-sm font-bold uppercase tracking-wider text-slate-400">
          Certificaciones
        </h2>
        <div className="flex flex-wrap gap-4">
          {certifications.map((certification) => (
            <div
              key={certification}
              className="flex items-center rounded border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600"
            >
              <CheckCircle className="mr-2 h-4 w-4 text-orange-500" /> {certification}
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} David Viejo — agenciaSEO.eu · Todos los derechos reservados
          </p>
        </div>
      </footer>
    </PortalShell>
  );
};

export default LandingPage;
