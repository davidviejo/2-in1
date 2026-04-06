import sys
import os
import json
import logging

# Add the parent directory to sys.path to allow imports from apps
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from apps.core.database import init_db, upsert_project, replace_clusters, get_project

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def ensure_diego_casas():
    logging.info("Initializing database...")
    init_db()

    project_id = "100"
    project_data = {
        "id": project_id,
        "name": "diego-casas",
        "domain": "https://www.diegocasas.es/",
        "geo": "ES",
        "competitors": "",
        "brand_name": "",
        "sitemap_url": "",
        "business_type": "blog"
    }

    clusters = [
        {
            "name": "Zaragoza",
            "url": "https://www.diegocasas.es/rinoplastia-en-zaragoza/mejor-cirujano/",
            "target_kw": "mejor cirujano rinoplastia zaragoza"
        },
        {
            "name": "Antes y despues",
            "url": "https://www.diegocasas.es/rinoplastia-en-zaragoza/antes-despues/",
            "target_kw": "antes y despues"
        },
        {
            "name": "Zaragoza",
            "url": "https://www.diegocasas.es/rinoplastia-en-zaragoza/precio/",
            "target_kw": "rinoplastia zaragoza"
        }
    ]

    logging.info(f"Upserting project '{project_data['name']}' (ID: {project_id})...")
    upsert_project(project_data)

    logging.info(f"Replacing clusters for project ID {project_id}...")
    replace_clusters(project_id, clusters)

    # Verify project in DB
    p = get_project(project_id)
    if p:
        logging.info("Project verification in DB successful.")
        logging.info(f"Project: {p['name']}, Clusters: {len(p['clusters'])}")
    else:
        logging.error("Project verification in DB failed!")
        sys.exit(1)

    # Verify client in clients_db.json
    clients_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'clients_db.json')
    try:
        with open(clients_db_path, 'r') as f:
            clients = json.load(f)

        client_exists = any(c.get('slug') == 'diego-casas' for c in clients)
        if client_exists:
            logging.info("Client 'diego-casas' found in clients_db.json.")
        else:
            logging.warning("Client 'diego-casas' NOT found in clients_db.json! You may need to add it manually.")
    except Exception as e:
        logging.error(f"Error checking clients_db.json: {e}")

if __name__ == "__main__":
    ensure_diego_casas()
