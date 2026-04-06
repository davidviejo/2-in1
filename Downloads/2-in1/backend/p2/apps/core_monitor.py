# Variable global compartida entre todos los hilos
GLOBAL_STATE = {
    'active': False,
    'tool_name': '',    # Ej: "Cluster SEO", "Auditoría"
    'action': 'Esperando...',
    'progress': 0
}

def update_global(tool_name, progress, action, active=True):
    """
    Llama a esta función desde cualquier worker para actualizar la barra lateral.
    """
    GLOBAL_STATE['active'] = active
    GLOBAL_STATE['tool_name'] = tool_name
    GLOBAL_STATE['progress'] = progress
    GLOBAL_STATE['action'] = action

def reset_global():
    GLOBAL_STATE['active'] = False
    GLOBAL_STATE['progress'] = 0
    GLOBAL_STATE['action'] = 'Inactivo'