# Guía de Gestión de Contraseñas y Proyectos

Este documento detalla cómo se gestionan las contraseñas y los proyectos en la plataforma.

## Almacenamiento de Datos

Los datos de los clientes y sus credenciales se almacenan en el archivo:
`backend/p2/clients_db.json`

Este archivo contiene un array de objetos JSON, donde cada objeto representa un cliente y contiene:
- `slug`: Identificador único del proyecto (usado en la URL).
- `name`: Nombre visible del proyecto.
- `status`: Estado del proyecto (`active` o `inactive`).
- `description`: Breve descripción.
- `project_password_hash`: El hash bcrypt de la contraseña de acceso.

## Contraseñas Globales (Entorno de Desarrollo)

Existen contraseñas maestras definidas para el entorno de desarrollo (normalmente en `backend/p2/ADMIN_ACCESS.md` o variables de entorno):

| Rol | Contraseña por defecto | Descripción |
| :--- | :--- | :--- |
| **Operador** | `demo_operator` | Acceso total a todos los paneles y herramientas. |
| **Área Clientes** | `demo_client` | Acceso al listado general de proyectos (aunque ahora es público). |

## Contraseñas de Proyectos Existentes

A continuación se listan los proyectos configurados actualmente y sus contraseñas de desarrollo conocidas (basadas en `generate_hash.py`):

| Proyecto (Slug) | Contraseña de Desarrollo | Hash (primeros caracteres) |
| :--- | :--- | :--- |
| `diego-casas` | `client_diego_2024` | `$2b$12$QG2Nmk...` |
| `demo-project` | *(Sin contraseña definida)* | `$2b$12$` (Incompleto) |

**Nota:** En producción, las contraseñas deben ser cambiadas y comunicadas de forma segura al cliente.

## Cómo Añadir un Nuevo Cliente y Contraseña

1.  **Generar el Hash de la Contraseña**:
    Utilice el script `backend/p2/generate_hash.py` para crear un hash seguro bcrypt.

    Edite el archivo `backend/p2/generate_hash.py`:
    ```python
    if __name__ == "__main__":
        password = "NUEVA_CONTRASEÑA_AQUI"
        hashed_password = generate_hash(password)
        print(f"Password: {password}")
        print(f"Hash: {hashed_password}")
    ```

    Ejecute el script desde la raíz del repositorio:
    ```bash
    python backend/p2/generate_hash.py
    ```
    Copie el hash generado (comienza por `$2b$`).

2.  **Actualizar la Base de Datos**:
    Abra `backend/p2/clients_db.json` y añada un nuevo objeto al array:

    ```json
    {
      "slug": "nuevo-proyecto",
      "name": "Nuevo Proyecto S.L.",
      "status": "active",
      "description": "Descripción del proyecto...",
      "project_password_hash": "PEGAR_HASH_AQUI"
    }
    ```

3.  **Verificación**:
    - El nuevo proyecto aparecerá automáticamente en la Home pública (`/`).
    - Intente acceder a `/p/nuevo-proyecto` usando la contraseña original (no el hash).
