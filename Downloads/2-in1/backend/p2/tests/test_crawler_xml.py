
import pytest
from apps.web.blueprints.crawler_tool import crawler_bp

def test_download_xml(client):
    urls = ['http://example.com/page1', 'http://example.com/page2']
    response = client.post('/crawler/download_xml', json={'urls': urls})

    assert response.status_code == 200
    assert 'application/xml' in response.headers['Content-Type']
    assert response.headers['Content-Disposition'] == 'attachment; filename=sitemap.xml'

    xml_content = response.data.decode('utf-8')
    assert '<?xml version="1.0" encoding="UTF-8"?>' in xml_content
    assert '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' in xml_content
    assert '<url><loc>http://example.com/page1</loc></url>' in xml_content
    assert '<url><loc>http://example.com/page2</loc></url>' in xml_content
    assert '</urlset>' in xml_content

def test_download_xml_empty(client):
    response = client.post('/crawler/download_xml', json={'urls': []})

    assert response.status_code == 200
    xml_content = response.data.decode('utf-8')
    assert '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' in xml_content
    assert '</urlset>' in xml_content
    assert '<url>' not in xml_content
