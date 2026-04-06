from unittest.mock import Mock, patch

from apps.web.blueprints.checklist_tool import check_url_compliance


HTML_DOC = '''
<html lang="es">
  <head>
    <title>Clinica Dental Madrid Centro</title>
    <meta name="description" content="Tratamientos dentales en Madrid centro con cita previa." />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [{
          "@type": "Question",
          "name": "¿Abrís los sábados?",
          "acceptedAnswer": {"@type": "Answer", "text": "Sí."}
        }]
      }
    </script>
  </head>
  <body>
    <h1>Clinica dental en Madrid</h1>
    <h2>Servicios</h2>
    <p>Texto de prueba para comprobar el conteo de palabras en la auditoría automática.</p>
    <img src="/img/local.jpg" alt="fachada clinica dental" />
    <img src="/img/team.jpg" />
    <a href="/contacto">Contacto</a>
    <a href="https://example.com/blog">Blog</a>
    <a href="https://externo.com">Externo</a>
    <iframe src="https://www.google.com/maps/embed?pb=test"></iframe>
  </body>
</html>
'''


@patch('apps.web.blueprints.checklist_tool.is_safe_url', return_value=True)
@patch('apps.web.blueprints.checklist_tool.requests.get')
def test_check_url_compliance_builds_correct_summary(mock_get, _mock_safe_url):
    mock_response = Mock(status_code=200, content=HTML_DOC.encode('utf-8'))
    mock_get.return_value = mock_response

    result = check_url_compliance('https://example.com/clinica')

    summary = result['summary']
    assert summary['Geolocalización'] == 'SI'
    assert summary['Datos Estructurados'] == 'SI'
    assert summary['Preguntas frecuentes'] == 'SI'
    assert summary['Snippet'] == 'Completo'
    assert summary['Imagenes'] == '2 (1 sin alt)'
    assert summary['Enlazado Interno'] == '2'
    assert summary['Estructura'] == 'Correcta'
    assert summary['Contenido'] == '21'

    assert result['snippet']['Title'] == 'Clinica Dental Madrid Centro'
    assert result['snippet']['Desc'] == 'Tratamientos dentales en Madrid centro con cita previa.'
    assert result['links'][0]['Href'] == 'https://example.com/contacto'
    assert result['links'][1]['Href'] == 'https://example.com/blog'


@patch('apps.web.blueprints.checklist_tool.is_safe_url', return_value=True)
@patch('apps.web.blueprints.checklist_tool.requests.get')
def test_check_url_compliance_marks_partial_snippet_when_only_title_exists(mock_get, _mock_safe_url):
    mock_response = Mock(status_code=200, content=b'<html><head><title>Solo title</title></head><body></body></html>')
    mock_get.return_value = mock_response

    result = check_url_compliance('https://example.com/simple')

    assert result['summary']['Snippet'] == 'Parcial'
    assert result['summary']['Datos Estructurados'] == 'NO'
    assert result['summary']['Preguntas frecuentes'] == 'NO'
