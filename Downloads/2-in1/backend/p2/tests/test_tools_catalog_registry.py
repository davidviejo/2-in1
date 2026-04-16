from flask import Flask

from apps.web.domains.registry import BlueprintSpec, DomainBootstrap, ToolMetadata
from apps.web.portal_bp import portal_bp
from apps.web.tools_catalog import get_tools_catalog


def test_tools_catalog_reads_blueprint_metadata_registry_dynamically():
    app = Flask(__name__)
    app.register_blueprint(portal_bp)

    first_bootstrap = (
        DomainBootstrap(
            domain='portal',
            core=(
                BlueprintSpec(
                    'apps.web.portal_bp',
                    'portal_bp',
                    ToolMetadata(
                        id='registry-probe',
                        name='Registry Probe',
                        path='/probe',
                        status='beta',
                        description='Descripción inicial',
                    ),
                ),
            ),
            namespaced=(),
            notes=(),
        ),
    )

    first_catalog = get_tools_catalog(app=app, bootstrap=first_bootstrap)
    assert first_catalog[0]['description'] == 'Descripción inicial'
    assert first_catalog[0]['runtime']['enabled'] is True

    updated_bootstrap = (
        DomainBootstrap(
            domain='portal',
            core=(
                BlueprintSpec(
                    'apps.web.portal_bp',
                    'portal_bp',
                    ToolMetadata(
                        id='registry-probe',
                        name='Registry Probe',
                        path='/probe',
                        status='beta',
                        description='Descripción actualizada',
                    ),
                ),
            ),
            namespaced=(),
            notes=(),
        ),
    )

    updated_catalog = get_tools_catalog(app=app, bootstrap=updated_bootstrap)
    assert updated_catalog[0]['description'] == 'Descripción actualizada'


def test_tools_catalog_marks_degraded_when_credentials_missing():
    app = Flask(__name__)
    app.register_blueprint(portal_bp)

    bootstrap = (
        DomainBootstrap(
            domain='portal',
            core=(
                BlueprintSpec(
                    'apps.web.portal_bp',
                    'portal_bp',
                    ToolMetadata(
                        id='needs-creds',
                        name='Needs creds',
                        path='/secure',
                        status='migrada',
                        description='Tool con dependencias',
                        required_credentials=('SERPAPI_KEY',),
                    ),
                ),
            ),
            namespaced=(),
            notes=(),
        ),
    )

    item = get_tools_catalog(app=app, bootstrap=bootstrap)[0]
    assert item['runtime']['requires_credentials'] is True
    assert item['runtime']['degraded'] is True

    app.config['SERPAPI_KEY'] = 'ok'
    item = get_tools_catalog(app=app, bootstrap=bootstrap)[0]
    assert item['runtime']['degraded'] is False
