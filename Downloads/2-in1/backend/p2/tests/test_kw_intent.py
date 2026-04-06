import pytest
from apps.web.blueprints.kw_intent import classify_keyword

def test_classify_keyword():
    res1 = classify_keyword("comprar zapatos")
    assert res1['intent'] == "Transaccional"

    res2 = classify_keyword("que es seo")
    assert res2['intent'] == "Informacional"

    res3 = classify_keyword("mejores auriculares")
    assert res3['intent'] == "Comercial"

    res4 = classify_keyword("iniciar sesion google")
    assert res4['intent'] == "Navegacional"

    res5 = classify_keyword("xyz abc")
    assert res5['intent'] == "Ambiguo / General"

def test_classify_endpoint():
    from apps.web import create_app
    app = create_app()
    app.config['TESTING'] = True
    client = app.test_client()

    # Test missing payload
    response = client.post('/kw_intent/classify')
    assert response.status_code == 200
    assert response.json.get('error') == 'Pon keywords'

    # Test valid keywords
    payload = {
        'keywords': "comprar zapatos\nque es seo\nmejores auriculares\niniciar sesion google\nxyz abc"
    }
    response = client.post('/kw_intent/classify', json=payload)
    assert response.status_code == 200
    data = response.json
    assert data['status'] == 'ok'

    stats = data['stats']
    assert stats['trans'] == 1
    assert stats['info'] == 1
    assert stats['comm'] == 1
    assert stats['nav'] == 1
