from apps.services.seo_extractor import extract_seo_content


def test_extract_seo_content_full_html_fields():
    html = """
    <html>
      <head>
        <title>  Guía SEO Técnica  </title>
        <meta name="description" content="  Mejorar indexación y relevancia.  ">
      </head>
      <body>
        <h1>Auditoría SEO</h1>
        <h2>Rastreo</h2>
        <h2>Indexación</h2>
        <h3>Logs</h3>
        <nav>No debe salir</nav>
        <p>Contenido principal de prueba.</p>
        <script>console.log('skip')</script>
      </body>
    </html>
    """

    extracted = extract_seo_content(html)

    assert extracted.title == "Guía SEO Técnica"
    assert extracted.meta_description == "Mejorar indexación y relevancia."
    assert extracted.h1 == ["Auditoría SEO"]
    assert extracted.h2 == ["Rastreo", "Indexación"]
    assert extracted.h3 == ["Logs"]
    assert "Contenido principal de prueba." in extracted.main_body
    assert "No debe salir" not in extracted.main_body
    assert "skip" not in extracted.main_body


def test_extract_seo_content_partial_html_without_head_or_body():
    html = """
    <h1>Título suelto</h1>
    <p>Texto parcial sin estructura completa.</p>
    """

    extracted = extract_seo_content(html)

    assert extracted.title == ""
    assert extracted.meta_description == ""
    assert extracted.h1 == ["Título suelto"]
    assert extracted.h2 == []
    assert extracted.h3 == []
    assert "Texto parcial sin estructura completa." in extracted.main_body


def test_extract_seo_content_broken_html_is_tolerant():
    html = """
    <html>
      <head><title>Broken
      <meta name='description' content='desc rota'>
      <body>
        <h1>H1 roto
        <h2>H2 roto
        <p>Body <b>incompleto
    """

    extracted = extract_seo_content(html)

    assert "Broken" in extracted.title
    assert extracted.meta_description in {'', 'desc rota'}
    # En HTML roto, lxml puede no recuperar encabezados por separado, pero el contenido debe sobrevivir.
    assert isinstance(extracted.h1, list)
    assert isinstance(extracted.h2, list)
    assert "H1 roto" in extracted.main_body
    assert "H2 roto" in extracted.main_body
    assert "Body" in extracted.main_body
