import React, { useEffect } from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PortalShell } from '../../components/shell/ShellVariants';

const trustPills = [
  '6+ años de experiencia',
  '80+ proyectos SEO',
  '+20 mercados internacionales',
  'Roadmaps orientados a KPIs',
];

const problemCards = [
  {
    title: 'Tu web no aparece donde debería',
    description:
      'Analizo arquitectura, contenidos e indexación para entender por qué Google no interpreta tus páginas clave y qué acciones pueden desbloquear visibilidad, tráfico cualificado y negocio.',
  },
  {
    title: 'Recibes tráfico, pero no oportunidades',
    description:
      'Cruzo intención de búsqueda, datos y embudos para convertir visitas orgánicas en oportunidades reales, no solo en sesiones que no aportan negocio ni aprendizaje.',
  },
  {
    title: 'Has perdido visibilidad o vienes de una migración',
    description:
      'Ordeno el diagnóstico técnico, detecto pérdidas de visibilidad y defino un plan de recuperación con responsables, prioridad, impacto esperado y siguientes pasos.',
  },
];

const methodologySteps = [
  {
    title: 'Diagnóstico',
    description:
      'Reviso rastreo, indexación, arquitectura, contenidos y datos de negocio para separar síntomas de causas, detectar bloqueos reales y entender dónde se pierde crecimiento orgánico en cada plantilla clave.',
  },
  {
    title: 'Priorización',
    description:
      'Transformo los hallazgos en un roadmap SEO con impacto esperado, esfuerzo, responsables y orden de ejecución para que el equipo avance sin dispersión ni tareas aisladas.',
  },
  {
    title: 'Acompañamiento',
    description:
      'Acompaño decisiones técnicas, contenido y medición para que cada cambio mejore visibilidad, captación cualificada y aprendizaje real del proyecto, sin perder foco estratégico ni saturar al equipo.',
  },
  {
    title: 'Medición',
    description:
      'Reviso resultados, ajusto prioridades y conecto el SEO con KPIs reales: leads, oportunidades, ingresos, eficiencia y crecimiento sostenible a medio plazo, con lectura ejecutiva clara para decidir.',
  },
];

const faqs = [
  {
    question: '¿Qué hace un consultor SEO?',
    answer:
      'Un consultor SEO analiza por qué tu web no capta todo el tráfico cualificado posible y convierte ese diagnóstico en prioridades. En mi caso, combino auditoría técnica, estrategia de contenidos, arquitectura, medición y foco en negocio para que el SEO no sea una lista de tareas, sino un sistema de crecimiento medible.',
  },
  {
    question: '¿Es mejor contratar un consultor SEO o una agencia?',
    answer:
      'Una agencia puede ser útil cuando necesitas mucha ejecución simultánea. Un consultor SEO estratégico encaja mejor si buscas criterio, priorización y acompañamiento cercano para decidir qué hacer, en qué orden y con qué impacto esperado. También puede coordinarse con tu equipo interno, desarrollo, contenido o paid media sin añadir capas innecesarias.',
  },
  {
    question: '¿Garantizas primeras posiciones en Google?',
    answer:
      'No prometo posiciones concretas porque Google depende de competencia, demanda, autoridad, tecnología y cambios del mercado. Sí trabajo con objetivos medibles: mejorar rastreo e indexación, aumentar visibilidad relevante, priorizar oportunidades y conectar el tráfico orgánico con leads, oportunidades o ingresos que puedas evaluar mes a mes con datos claros y accionables.',
  },
];

const LandingPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Consultor SEO estratégico | David Viejo';

    const descriptionContent =
      'Consultor SEO estratégico para mejorar visibilidad, tráfico cualificado y conversión. Roadmap claro, foco en negocio y diagnóstico SEO gratuito.';
    let descriptionTag = document.querySelector('meta[name="description"]');

    if (!descriptionTag) {
      descriptionTag = document.createElement('meta');
      descriptionTag.setAttribute('name', 'description');
      document.head.appendChild(descriptionTag);
    }

    descriptionTag.setAttribute('content', descriptionContent);
  }, []);

  return (
    <PortalShell contentClassName="w-full text-slate-800 selection:bg-orange-500 selection:text-white">
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="max-w-4xl space-y-8">
          <span className="inline-flex rounded-full bg-orange-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-orange-700">
            Consultor SEO estratégico
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-blue-900 md:text-5xl">
            Consultor SEO estratégico para crecer con resultados medibles
          </h1>
          <p className="text-lg leading-relaxed text-slate-600">
            Detecto bloqueos, priorizo oportunidades y convierto el tráfico orgánico en captación cualificada con una estrategia SEO alineada a tus objetivos de negocio.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button className="bg-orange-500 text-white hover:bg-orange-600">
              Solicita tu diagnóstico SEO gratuito y prioriza tu crecimiento
            </Button>
            <Button variant="secondary" className="border-slate-200 text-slate-700 hover:border-orange-200 hover:text-orange-600">
              Ver cómo trabajo
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Consultoría SEO con foco en negocio, no en tareas sueltas
        </h2>
        <p className="mt-4 max-w-5xl text-base leading-relaxed text-slate-600">
          Combino experiencia estratégica, análisis técnico y lectura de negocio para priorizar lo que realmente mueve resultados. He trabajado en más de 80 proyectos, con presencia en más de 20 mercados internacionales y herramientas como SISTRIX, Search Console, Analytics, Ahrefs, Semrush y Oncrawl.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trustPills.map((pill) => (
            <Card key={pill} className="px-4 py-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-800">{pill}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Problemas que resuelve un consultor SEO</h2>
        <p className="mt-4 max-w-5xl text-base leading-relaxed text-slate-600">
          El SEO no suele fallar por una sola causa. Puede haber problemas técnicos, contenidos sin intención clara, arquitectura débil, pérdida de visibilidad o tráfico que no convierte. Mi trabajo es ordenar el diagnóstico y convertirlo en decisiones accionables.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {problemCards.map((card) => (
            <Card key={card.title} className="h-full border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Cómo trabajo una consultoría SEO estratégica</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {methodologySteps.map((step, idx) => (
            <Card key={step.title} className="border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-500">Step {idx + 1}</p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <Card className="border border-blue-100 bg-blue-50 p-8 shadow-sm">
          <h2 className="text-3xl font-bold tracking-tight text-blue-900">Consultoría SEO preparada para la búsqueda con IA</h2>
          <p className="mt-4 text-base leading-relaxed text-blue-900/80">
            La búsqueda ya no depende solo de keywords. También importan entidades, autoridad, utilidad del contenido y presencia en respuestas generadas por IA. Por eso integro el Pronóstico SEO 2026 en la consultoría: para revisar cómo tu sector puede adaptarse a AI Overviews, ChatGPT y nuevas formas de descubrimiento orgánico.
          </p>
          <Button className="mt-6 bg-blue-700 text-white hover:bg-blue-800">
            Descubre cómo adaptar tu SEO a la era IA
          </Button>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Preguntas frecuentes sobre consultor SEO</h2>
        <div className="mt-8 space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.question} className="border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">{faq.question}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="border border-orange-200 bg-orange-50 p-8 shadow-sm">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Convierte tu SEO en un plan claro de crecimiento</h2>
          <p className="mt-4 max-w-4xl text-base leading-relaxed text-slate-700">
            Hablemos de tu contexto, tus objetivos y los bloqueos que están limitando tu captación orgánica. Te ayudaré a identificar prioridades y próximos pasos con foco en impacto real.
          </p>
          <Button className="mt-6 bg-orange-500 text-white hover:bg-orange-600">
            Reserva una llamada y convierte tus bloqueos SEO en un plan accionable
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      </section>

      <footer className="mt-12 border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          <p className="inline-flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            © {new Date().getFullYear()} David Viejo — consultoría SEO estratégica.
          </p>
        </div>
      </footer>
    </PortalShell>
  );
};

export default LandingPage;
