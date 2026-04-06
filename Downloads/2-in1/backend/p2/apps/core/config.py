import os
import secrets

class Config:
    # Basic Config
    SECRET_KEY = os.environ.get('SECRET_KEY', secrets.token_hex(32))

    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload size

    # Database
    DATABASE_URL = os.environ.get('DATABASE_URL')

    # Frontend URL for CORS
    FRONTEND_URL = os.environ.get('FRONTEND_URL') or 'http://localhost:5173'

    # Default consent cookie for Google scraping
    # SECURITY NOTE: This cookie should be rotated frequently and kept secret.
    DEFAULT_COOKIE = os.environ.get('GOOGLE_DEFAULT_COOKIE', '')

    USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ]

    # Bot Simulator User Agents
    BOT_SIM_UA_USER = os.environ.get('BOT_SIM_UA_USER', 'Mozilla/5.0 (Windows NT 10.0)')
    BOT_SIM_UA_BOT = os.environ.get('BOT_SIM_UA_BOT', 'Mozilla/5.0 (compatible; Googlebot/2.1)')

    # DataForSEO Credentials
    DATAFORSEO_LOGIN = os.environ.get('DATAFORSEO_LOGIN')
    DATAFORSEO_PASSWORD = os.environ.get('DATAFORSEO_PASSWORD')

    # Portal Auth
    CLIENTS_AREA_PASSWORD = os.environ.get('CLIENTS_AREA_PASSWORD', '123456')
    OPERATOR_PASSWORD = os.environ.get('OPERATOR_PASSWORD', '123456')

    JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))

    # Job Runner Configuration
    JOBS_CONCURRENCY_LIMIT = int(os.environ.get('JOBS_CONCURRENCY_LIMIT', 2))
    JOBS_POLL_INTERVAL = int(os.environ.get('JOBS_POLL_INTERVAL', 5))

    # API Engine Limits
    ENGINE_MAX_KEYWORDS_PER_URL = int(os.environ.get('ENGINE_MAX_KEYWORDS_PER_URL', 20))
    ENGINE_MAX_COMPETITORS_PER_KEYWORD = int(os.environ.get('ENGINE_MAX_COMPETITORS_PER_KEYWORD', 5))
    ENGINE_MAX_URLS_PER_BATCH = int(os.environ.get('ENGINE_MAX_URLS_PER_BATCH', 100))

    # Google scraping fallback controls (conservative by default)
    GOOGLE_SCRAPING_AUTO_FALLBACK = os.environ.get('GOOGLE_SCRAPING_AUTO_FALLBACK', 'false').lower() == 'true'
    GOOGLE_SCRAPING_FALLBACK_MODE = os.environ.get('GOOGLE_SCRAPING_FALLBACK_MODE', 'explicit_error')
    GOOGLE_SCRAPING_RETRY_MIN_JITTER = float(os.environ.get('GOOGLE_SCRAPING_RETRY_MIN_JITTER', 0.4))
    GOOGLE_SCRAPING_RETRY_MAX_JITTER = float(os.environ.get('GOOGLE_SCRAPING_RETRY_MAX_JITTER', 1.2))
    ENABLE_DDG_FALLBACK = os.environ.get('ENABLE_DDG_FALLBACK', 'false').lower() == 'true'
