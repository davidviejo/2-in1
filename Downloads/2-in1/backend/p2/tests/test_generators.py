import pytest
from apps.web.blueprints.pixel_tool import get_px

# --- Tests for apps.web.blueprints.pixel_tool.py ---

def test_get_px_normal():
    # "Hola" -> 4 chars * 9 = 36 pixels (approx)
    assert get_px("Hola") == 36
    # With scale 0.9 -> 36 * 0.9 = 32 (int)
    assert get_px("Hola", scale=0.9) == 32

def test_get_px_edge():
    assert get_px("") == 0
    assert get_px(None) == 0

# --- Tests for apps/local_tool.py (Keyword Mixer) ---

def test_local_mixer_normal(client):
    data = {
        'col_a': 'uno\ndos',
        'col_b': 'rojo',
        'col_c': '',
        'match_type': 'broad'
    }
    resp = client.post('/local/generate', json=data)
    assert resp.status_code == 200
    res = resp.get_json()
    assert res['status'] == 'ok'
    # Should generate: "uno rojo", "dos rojo"
    assert res['count'] == 2
    assert "uno rojo" in res['keywords']
    assert "dos rojo" in res['keywords']

def test_local_mixer_phrase(client):
    data = {
        'col_a': 'seo',
        'col_b': 'madrid',
        'match_type': 'phrase'
    }
    resp = client.post('/local/generate', json=data)
    res = resp.get_json()
    assert '"seo madrid"' in res['keywords']

def test_local_mixer_edge(client):
    data = {'col_a': '', 'col_b': ''}
    resp = client.post('/local/generate', json=data)
    res = resp.get_json()
    assert res['count'] == 0
    assert res['keywords'] == []

# --- Tests for apps/dorks_tool.py ---

def test_dorks_gen_normal(client):
    resp = client.post('/dorks/generate', json={'domain': 'example.com'})
    assert resp.status_code == 200
    res = resp.get_json()
    assert res['status'] == 'ok'
    dorks = res['dorks']
    assert len(dorks) > 0
    # Check one dork content
    assert 'site:example.com' in dorks[0]['link']

def test_dorks_gen_edge(client):
    # Empty domain should still return dorks structure but with empty domain
    resp = client.post('/dorks/generate', json={'domain': ''})
    res = resp.get_json()
    assert res['status'] == 'ok'
    assert 'site:' in res['dorks'][0]['link']

# --- Tests for apps/utm_tool.py ---

def test_utm_gen_normal(client):
    data = {
        'urls': 'http://example.com\nhttp://test.com',
        'source': 'google',
        'medium': 'cpc',
        'campaign': 'summer'
    }
    resp = client.post('/utm/generate', json=data)
    assert resp.status_code == 200
    res = resp.get_json()
    assert res['status'] == 'ok'
    assert len(res['urls']) == 2
    assert 'utm_source=google' in res['urls'][0]
    assert 'utm_medium=cpc' in res['urls'][0]
    assert 'utm_campaign=summer' in res['urls'][0]

def test_utm_gen_error(client):
    # Missing campaign
    data = {
        'urls': 'http://example.com',
        'source': 'google',
        'medium': 'cpc'
    }
    resp = client.post('/utm/generate', json=data)
    assert resp.status_code == 400
    res = resp.get_json()
    assert res['status'] == 'error'
    assert 'Missing required fields' in res['msg']
