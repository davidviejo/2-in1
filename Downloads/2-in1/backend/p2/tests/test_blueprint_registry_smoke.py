def test_smoke_critical_endpoints_are_registered(app):
    routes = {rule.rule for rule in app.url_map.iter_rules()}

    expected_exact = {
        '/api/health',
        '/api/auth/clients-area',
        '/api/settings/config',
    }

    for route in expected_exact:
        assert route in routes, f'Missing critical endpoint: {route}'

    assert any(route.startswith('/api/v1/project-api') for route in routes), (
        'Project API endpoints were not registered under /api/v1/project-api'
    )
