import sys
import os
import requests
import json

# Add parent dir to path to import apps if needed, but we will test via http requests to localhost
# We need to run the app in background or assume it is running?
# Better: We can import create_app and use test client.

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from apps.web import create_app

def test_manual_auth():
    # Setup test app
    app = create_app()
    app.config['TESTING'] = True
    app.config['CLIENTS_AREA_PASSWORD'] = 'secret_clients_pass'
    app.config['OPERATOR_PASSWORD'] = 'secret_operator_pass'
    app.config['JWT_SECRET'] = 'test_secret'

    # Create a test client
    client = app.test_client()

    print("1. Testing Health Check...")
    res = client.get('/api/health')
    print(f"Status: {res.status_code}, Body: {res.json}")
    assert res.status_code == 200

    print("\n2. Testing Clients Area Auth (Success)...")
    res = client.post('/api/auth/clients-area', json={'password': 'secret_clients_pass'})
    print(f"Status: {res.status_code}, Body: {res.json}")
    assert res.status_code == 200
    token = res.json['token']
    assert token is not None

    print("\n3. Testing Clients Area Auth (Fail)...")
    res = client.post('/api/auth/clients-area', json={'password': 'wrong_pass'})
    print(f"Status: {res.status_code}")
    assert res.status_code == 401

    print("\n4. Testing List Clients (Protected)...")
    # Without token
    res = client.get('/api/clients')
    assert res.status_code == 401

    # With token
    res = client.get('/api/clients', headers={'Authorization': f'Bearer {token}'})
    print(f"Status: {res.status_code}, Body: {res.json}")
    assert res.status_code == 200
    assert isinstance(res.json, list)

    print("\n5. Testing Operator Auth...")
    res = client.post('/api/auth/operator', json={'password': 'secret_operator_pass'})
    print(f"Status: {res.status_code}, Body: {res.json}")
    assert res.status_code == 200
    op_token = res.json['token']

    print("\n6. Testing Operator Tool Run...")
    res = client.post('/api/tools/run/some_tool', headers={'Authorization': f'Bearer {op_token}'})
    print(f"Status: {res.status_code}, Body: {res.json}")
    assert res.status_code == 200

    print("\nALL TESTS PASSED")

if __name__ == "__main__":
    test_manual_auth()
