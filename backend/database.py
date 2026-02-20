from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import urlparse, unquote
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


def _resolve_mongo_url() -> str:
    mongo_url = os.getenv('MONGO_URL') or os.getenv('MONGODB_URI')
    if not mongo_url:
        raise RuntimeError(
            "MongoDB URL is missing. Set MONGO_URL (or MONGODB_URI) in the environment."
        )
    return mongo_url


def _resolve_db_name(mongo_url: str) -> str:
    db_name = os.getenv('DB_NAME')
    if db_name:
        return db_name

    parsed = urlparse(mongo_url)
    path = (parsed.path or '').strip('/')

    if path:
        # path can contain extra segments depending on connection string style;
        # use the first segment as db name.
        inferred_name = unquote(path.split('/', 1)[0]).strip()
        if inferred_name:
            return inferred_name

    raise RuntimeError(
        "Database name is missing. Set DB_NAME, or include a database name in MONGO_URL/MONGODB_URI."
    )


mongo_url = _resolve_mongo_url()
db_name = _resolve_db_name(mongo_url)

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]
