📘 Manual de Operaciones: SEO Suite Ultimate v17
Objetivo: Centralizar la consultoría SEO en una sola interfaz, eliminando la necesidad de pagar múltiples suscripciones (Screaming Frog, SurferSEO, Semrush) para tareas cotidianas.
1. La Interfaz de Control
Al abrir la aplicación, te encontrarás con el Panel de Control (Dashboard).
Barra Lateral Izquierda (Menú): Es tu centro de navegación. Está dividido por fases del proyecto (Estrategia, Auditoría, On-Page, Arquitectura, etc.).
Widget "Google API Hoy": Situado en la barra lateral. Te indica cuántas consultas "de pago" (API Oficial) has gastado hoy.
🟢 Verde: < 80 consultas.
🔴 Rojo: > 100 consultas (Límite gratuito diario alcanzado).
Área Principal: Donde se ejecutan las herramientas y se visualizan los resultados.
2. Módulos y Capacidades
🚀 Fase 1: Estrategia y Palabras Clave
Para empezar un proyecto o buscar nuevas oportunidades de tráfico.
Cluster & SERP: Pega 1.000 palabras clave desordenadas. La IA las agrupará por "Intención de Búsqueda". Úsalo para limpiar Keyword Research.
KW Discovery: Escribe una palabra ("seguros") y obtén 300 ideas del autocompletar de Google.
KW Intent: Clasifica automáticamente si una palabra es para Vender (Transaccional) o para el Blog (Informacional).
Content Gap: Introduce tu URL y la de 3 competidores. Te dirá qué palabras clave están usando ellos que tú has olvidado.
SERP Overlap: ¿Dudas si crear dos artículos o uno? Esta herramienta te dice si Google muestra los mismos resultados para dos búsquedas distintas.
SERP Analyzer: Compara la longitud, imágenes y encabezados del Top 10 vs tu web.
🕸️ Fase 2: Auditoría Técnica
Para detectar por qué una web no posiciona o tiene errores.
Auditor Técnico: Escáner profundo. Revisa H1, Metas y Thin Content de un Sitemap entero.
Checklist Auto: Genera un Excel masivo con columnas SI/NO (Schema, Geo, Https) para informes rápidos.
Index Guard: Verifica si tienes etiquetas noindex o canonicals mal configurados que impiden salir en Google.
Robots.txt Tester: Comprueba si estás bloqueando a Googlebot desde el servidor.
Fast Status: Comprobación ultrarrápida de códigos 404/200 para listas de miles de URLs.
Tech Spy: Espía qué CMS (WordPress, Shopify) y Plugins usa la competencia.
E-E-A-T Trust: Evalúa si la web transmite confianza (Autores, Políticas, Citas).
🧠 Fase 3: On-Page y Semántica
Para redactar y optimizar el contenido individual.
NLP Analyzer: Inteligencia Artificial que lee tu texto. Te dice si es Positivo/Negativo, el nivel de lectura y extrae Entidades (Marcas, Personas).
KW Prominence: Analiza si has colocado la palabra clave en los "lugares calientes" (Inicio del título, H1, primer párrafo).
Snippet Target: Te ayuda a redactar el párrafo perfecto (40-60 palabras) para ganar la "Posición 0" en Google.
Readability: Resalta en colores las frases demasiado largas o complejas.
Duplicity: Compara dos URLs para detectar plagio o contenido duplicado interno.
Content Decay: Detecta artículos antiguos que necesitan actualización urgente.
🏗️ Fase 4: Arquitectura Web
Para optimizar la estructura y el flujo de autoridad.
Link Graph: Genera un mapa visual de nodos interactivo. Ideal para detectar páginas aisladas.
Click Depth: Calcula a cuántos clics de la Home está cada página. (Objetivo: < 3 clics).
LinkRank: Calcula el PageRank interno matemático de cada URL.
Link Sculpting: Cuenta enlaces salientes para evitar diluir tu autoridad.
Orphan Hunter: Cruza el Sitemap con un rastreo real para encontrar páginas huérfanas.
Header Map: Visualiza el esqueleto (H1-H3) de tu web comparado con la competencia.
🛠️ Fase 5: Operaciones y Utilidades
Herramientas de día a día para ahorrar tiempo.
ROI Projector: Calculadora financiera para vender proyectos SEO (Proyección de ingresos).
Data Cleaner: Limpia listas sucias, extrae emails y deduplica URLs.
Frameworks: Guías paso a paso integradas (SOPs) para saber qué hacer en cada caso.
UTM Builder: Crea enlaces para campañas.
Google Dorks: Genera comandos de búsqueda para encontrar hackeos o archivos basura.
3. Configuración del Motor de Búsqueda
La herramienta es única porque te permite elegir cómo buscas en Google. En el panel de configuración verás un selector "Motor":
DuckDuckGo (Recomendado): Es gratis, rápido y no bloquea. Úsalo para tareas masivas (Clustering, Bulk Check). Nota: Los datos son un 90% similares a Google.
Google Scraping (Sin Cookies): Intenta leer Google directamente. Úsalo con precaución y pausas altas (Delay > 5s).
Google Nuclear (Con Cookies): Si pegas tu cookie de sesión, la herramienta "se disfraza" de ti. Obtienes resultados 100% reales y personalizados.
Google API Oficial: La opción profesional. Requiere tu API Key. 100% precisa, legal y sin riesgos de bloqueo. (100 consultas gratis/día).
4. Flujos de Trabajo Recomendados (Playbooks)
🅰️ Para una Nueva Auditoría de Cliente
Ve a Google Dorks > Busca indexación de archivos basura o HTTP.
Ve a Auditor Técnico > Escanea el Sitemap.
Ve a Bot Simulator > Asegúrate de que no bloquean a Google.
Ve a ROI Projector > Prepara la diapositiva de ventas con la proyección de dinero.
🅱️ Para Crear Contenido Nuevo
Ve a KW Discovery > Busca ideas.
Ve a SEO Cluster > Agrupa las ideas.
Ve a Content Gap > Mira qué palabras usa el líder.
Ve a Header Map > Copia su estructura.
Ve a Draft Editor > Redacta y valida la calidad.
🆎 Para una Migración Web
Ve a Diff Checker > Compara la web de desarrollo con la vieja.
Ve a Redirect Tracer > Asegura que las redirecciones son directas (200 o 301 limpio).
Ve a Migration Helper > Genera el código .htaccess automáticamente.
5. Solución de Problemas Comunes
"Google me ha bloqueado (Error 429)": Cambia el motor a DuckDuckGo o aumenta el Delay a 10 segundos. Si usas Google Nuclear, renueva la cookie.
"La web sale vacía o con 0 palabras": Esa web usa JavaScript (React/Angular). El sistema intentará usar el "Scraper Híbrido" automáticamente, pero tardará un poco más. Ten paciencia.
"Error de conexión": Verifica que la URL incluye http:// o https://.