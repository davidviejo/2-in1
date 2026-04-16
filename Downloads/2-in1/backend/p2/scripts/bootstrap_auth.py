#!/usr/bin/env python3
"""Bootstrap auth passwords by writing bcrypt hashes into backend/p2/.env."""

from __future__ import annotations

import argparse
import getpass
from pathlib import Path

import bcrypt


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Generate bcrypt hashes for portal auth and persist them to .env',
    )
    parser.add_argument('--clients-password', help='Plain password for CLIENTS_AREA_PASSWORD')
    parser.add_argument('--operator-password', help='Plain password for OPERATOR_PASSWORD')
    parser.add_argument('--env-file', default='.env', help='Path to .env file (default: backend/p2/.env)')
    return parser.parse_args()


def ask_password(prompt: str) -> str:
    while True:
        value = getpass.getpass(prompt)
        if value.strip():
            return value
        print('Password cannot be empty. Try again.')


def upsert_env_value(content: str, key: str, value: str) -> str:
    lines = content.splitlines()
    updated = False

    for index, line in enumerate(lines):
        if line.startswith(f'{key}='):
            lines[index] = f'{key}={value}'
            updated = True
            break

    if not updated:
        if lines and lines[-1].strip() != '':
            lines.append('')
        lines.append(f'{key}={value}')

    return '\n'.join(lines) + '\n'


def main() -> None:
    args = parse_args()
    env_path = Path(args.env_file)

    clients_plain = args.clients_password or ask_password('Clients area password: ')
    operator_plain = args.operator_password or ask_password('Operator password: ')

    clients_hash = bcrypt.hashpw(clients_plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    operator_hash = bcrypt.hashpw(operator_plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    current = env_path.read_text(encoding='utf-8') if env_path.exists() else ''
    current = upsert_env_value(current, 'CLIENTS_AREA_PASSWORD', clients_hash)
    current = upsert_env_value(current, 'OPERATOR_PASSWORD', operator_hash)

    env_path.write_text(current, encoding='utf-8')

    print(f'Auth bootstrap complete: {env_path.resolve()}')
    print('Stored CLIENTS_AREA_PASSWORD and OPERATOR_PASSWORD as bcrypt hashes.')


if __name__ == '__main__':
    main()
