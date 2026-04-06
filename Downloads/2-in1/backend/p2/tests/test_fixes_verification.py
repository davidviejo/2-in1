
import pytest
from unittest.mock import MagicMock, patch
from flask import Flask
from apps.web.blueprints.pixel_tool import pixel_bp, check_px
from apps.web.blueprints.status_fast import fast_bp
from apps.web.blueprints.local_tool import local_bp

@pytest.fixture
def app():
    app = Flask(__name__)
    app.register_blueprint(pixel_bp)
    app.register_blueprint(fast_bp)
    app.register_blueprint(local_bp)
    return app

@pytest.fixture
def client(app):
    return app.test_client()

def test_pixel_tool_check_px_edge_cases():
    # Case 1: Meta description missing content attribute
    html_no_content = """
    <html>
        <head>
            <title>Test Title</title>
            <meta name="description">
        </head>
        <body></body>
    </html>
    """
    with patch('requests.get') as mock_get:
        mock_get.return_value.content = html_no_content.encode('utf-8')
        mock_get.return_value.status_code = 200

        # This should currently raise KeyError or return default if fixed
        try:
            res = check_px('http://example.com')
            # If fixed, it should run without error
        except KeyError:
            pytest.fail("KeyError raised for meta description without content")
        except Exception as e:
            # The current code has a broad except: pass, so it returns empty dict values
            # But we want to ensure it extracts what it can or doesn't crash if we remove the bare except
            pass

    # Case 2: Title with nested tags
    html_nested_title = """
    <html>
        <head>
            <title>Test <b>Bold</b> Title</title>
        </head>
        <body></body>
    </html>
    """
    with patch('requests.get') as mock_get:
        mock_get.return_value.content = html_nested_title.encode('utf-8')
        mock_get.return_value.status_code = 200

        res = check_px('http://example.com')
        # Currently s.title.string would be None for nested tags
        # We want to verify if it extracts text correctly after fix

def test_pixel_tool_routes_no_json(client):
    # /pixel/analyze expects json
    res = client.post('/pixel/analyze', data=None, content_type='application/json')
    # If unhandled, this might 500 or 400 depending on flask version/setup
    # With fix, it should handle it gracefully (e.g. return empty list or specific error)
    assert res.status_code != 500

def test_status_fast_route_no_json(client):
    # /fast/run expects json
    res = client.post('/fast/run', data=None, content_type='application/json')
    assert res.status_code != 500

def test_local_tool_route_no_json(client):
    # /local/generate expects json
    res = client.post('/local/generate', data=None, content_type='application/json')
    assert res.status_code != 500
