import bcrypt

def generate_hash(password):
    """Generates a bcrypt hash for the given password."""
    # Ensure bytes
    if isinstance(password, str):
        password = password.encode('utf-8')
    # Generate salt and hash
    hashed = bcrypt.hashpw(password, bcrypt.gensalt())
    return hashed.decode('utf-8')

if __name__ == "__main__":
    password = "client_diego_2024"
    hashed_password = generate_hash(password)
    print(f"Password: {password}")
    print(f"Hash: {hashed_password}")
