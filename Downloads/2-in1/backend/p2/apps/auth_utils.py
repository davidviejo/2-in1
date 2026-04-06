import jwt
import bcrypt
import datetime
import os
from flask import current_app

def hash_password(password):
    """Hashes a password using bcrypt."""
    if isinstance(password, str):
        password = password.encode('utf-8')
    return bcrypt.hashpw(password, bcrypt.gensalt()).decode('utf-8')

def check_password_hash(password, hashed):
    """Checks a password against a bcrypt hash."""
    if not hashed:
        return False
    # Ensure bytes
    if isinstance(password, str):
        password = password.encode('utf-8')
    if isinstance(hashed, str):
        hashed = hashed.encode('utf-8')
    try:
        return bcrypt.checkpw(password, hashed)
    except Exception:
        return False

def check_global_password(password, env_var_name):
    """Checks a password against an environment variable (plain text or hash logic if needed).
    For MVP, we assume the env var stores the RAW password or a bcrypt hash.
    Ideally, env vars should be complex. Here we will compare plain text for simplicity
    unless it looks like a hash, but user asked for bcrypt.

    Actually, user said: "CLIENTS_AREA_PASSWORD (ideal bcrypt)".
    So we will assume the env var contains the HASH.
    """
    target_hash = current_app.config.get(env_var_name)
    if not target_hash:
        return False

    # Check if target_hash looks like a bcrypt hash (starts with $2b$ or $2a$)
    # target_hash is a string here because it comes from os.environ or config dict
    if isinstance(target_hash, str) and target_hash.startswith('$2'):
         return check_password_hash(password, target_hash)

    # Fallback to plain text comparison if not hashed (for easier dev setup)
    return password == target_hash

def create_token(role, scope=None, expires_in_hours=24):
    """Creates a JWT token."""
    payload = {
        'role': role,
        'scope': scope,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=expires_in_hours),
        'iat': datetime.datetime.utcnow()
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET'], algorithm='HS256')

def verify_token(token):
    """Verifies a JWT token."""
    try:
        payload = jwt.decode(token, current_app.config['JWT_SECRET'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
