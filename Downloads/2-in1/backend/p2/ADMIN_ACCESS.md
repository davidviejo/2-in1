# Acceso Administrativo y Gestión de Clientes

Este documento describe cómo gestionar el acceso a los proyectos y cómo añadir nuevos clientes al sistema.

## Roles de Usuario

El sistema maneja tres niveles de acceso principales:

1.  **Operator (`operator`)**:
    *   Tiene acceso total a todas las herramientas y proyectos.
    *   Puede iniciar sesión en la consola de operador (`/operator`) usando la `OPERATOR_PASSWORD`.
    *   **NUEVO**: Puede iniciar sesión en *cualquier* proyecto individual (`/c/<slug>`) usando la `OPERATOR_PASSWORD`. Esto otorga permisos de operador sobre ese proyecto.

2.  **Clients Area (`clients_area`)**:
    *   Acceso general al dashboard de clientes.
    *   Se autentica usando la `CLIENTS_AREA_PASSWORD`.

3.  **Project Client (`project`)**:
    *   Acceso restringido a un único proyecto.
    *   Se autentica usando una contraseña específica para ese proyecto (almacenada como hash bcrypt).

## Contraseñas de Ejemplo (Entorno de Desarrollo)

Estas son las contraseñas configuradas por defecto en `config.py` o `.env`:

*   **Operator Password (Master)**: `demo_operator`
*   **Clients Area Password**: `demo_client`

**IMPORTANTE**: Cambie estas contraseñas en el archivo `.env` para entornos de producción.

## Gestión de Clientes

La base de datos de clientes se encuentra en `backend/p2/clients_db.json`.
La base de datos de proyectos (datos SEO) se encuentra en `backend/p2/projects_db.json`.

### Añadir un Nuevo Cliente

1.  **Generar Hash de Contraseña**:
    Para seguridad, las contraseñas de los clientes se almacenan como hashes bcrypt.
    Utilice el script `backend/p2/generate_hash.py` para generar un hash.

    Edite el script `backend/p2/generate_hash.py`:
    ```python
    if __name__ == "__main__":
        password = "su_contraseña_aqui"  # <--- Cambie esto
        hashed_password = generate_hash(password)
        print(f"Password: {password}")
        print(f"Hash: {hashed_password}")
    ```

    Ejecute el script:
    ```bash
    python backend/p2/generate_hash.py
    ```
    Copie el valor del hash generado (empieza por `$2b$`).

2.  **Editar `clients_db.json`**:
    Añada una nueva entrada al array JSON:
    ```json
    {
      "slug": "nombre-empresa-slug",
      "name": "Nombre Empresa",
      "status": "active",
      "description": "Descripción del cliente.",
      "project_password_hash": "$2b$12$..." // <--- Pegue el hash aquí
    }
    ```

3.  **Editar `projects_db.json`**:
    Asegúrese de que existe una entrada correspondiente en la base de datos de proyectos para que el cliente pueda ver sus datos.
    ```json
    {
        "id": "...", // ID único
        "name": "nombre-empresa-slug", // DEBE coincidir con el slug en clients_db.json (o la lógica de enlace que se use)
        "domain": "https://...",
        ...
    }
    ```
    *Nota: Actualmente, el sistema enlaza por `slug` en la autenticación, pero el dashboard recupera datos. Asegúrese de que los identificadores sean consistentes.*

## Ejemplo: Diego Casas

Se ha configurado un cliente de ejemplo:

*   **Slug**: `diego-casas`
*   **Contraseña**: `client_diego_2024`
*   **Login URL**: `/c/diego-casas`

Puede acceder a este proyecto usando la contraseña `client_diego_2024` (rol de cliente) o usando `demo_operator` (rol de operador).
