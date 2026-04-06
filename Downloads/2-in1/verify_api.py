import requests
import sys

def verify_public_clients():
    url = "http://localhost:5000/api/public/clients"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            print("SUCCESS: Fetched public clients successfully.")
            for client in data:
                print(f"Client: {client.get('name')} ({client.get('slug')})")
                if 'project_password_hash' in client:
                    print("FAILURE: Password hash exposed!")
                    sys.exit(1)
        else:
            print(f"FAILURE: Status code {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"FAILURE: {e}")
        sys.exit(1)

if __name__ == "__main__":
    verify_public_clients()
