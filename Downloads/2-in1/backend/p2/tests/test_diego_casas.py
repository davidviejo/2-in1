import pytest
import os
import sys
import json

# Ensure backend/p2 is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from apps.core.database import get_project, get_all_projects

def test_diego_casas_project_exists():
    """Verify that the project 'diego-casas' exists in the database."""
    project_id = "100"
    project = get_project(project_id)

    assert project is not None
    assert project['name'] == 'diego-casas'
    assert project['domain'] == 'https://www.diegocasas.es/'
    assert len(project['clusters']) == 3

    cluster_names = [c['name'] for c in project['clusters']]
    assert "Zaragoza" in cluster_names
    assert "Antes y despues" in cluster_names

def test_diego_casas_client_exists():
    """Verify that the client 'diego-casas' exists in clients_db.json."""
    clients_db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'clients_db.json')

    with open(clients_db_path, 'r') as f:
        clients = json.load(f)

    client = next((c for c in clients if c['slug'] == 'diego-casas'), None)

    assert client is not None
    assert client['name'] == 'Diego Casas'
    assert client['status'] == 'active'
