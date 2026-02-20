# PrizeWheel Pro – Backend deployment notes (Render)

## Pourquoi le build échouait
Le log indique un build en **Python 3.14** (`.../.venv/bin/python3.14`).
Dans ce cas, `pydantic-core` peut partir en compilation Rust (`maturin`) au lieu d'une wheel précompilée, puis échouer.

## Configuration Render (copier-coller)

### Root Directory
```text
backend
```

### Build Command
```bash
pip install -r requirements.txt
```

### Start Command
```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

### Version Python
Utilise **3.12.9** (définie dans `render.yaml` via `PYTHON_VERSION`) et `backend/runtime.txt`.

### Variables d'environnement minimales
- `MONGO_URL` **ou** `MONGODB_URI`
- `DB_NAME` (optionnel si déjà présent dans l'URI Mongo)
- `JWT_SECRET`
- `SUPER_ADMIN_PASSWORD`
- `DEMO_TENANT_PASSWORD`

### Option recommandée
- `PIP_PREFER_BINARY=1` pour privilégier les wheels précompilées pendant `pip install`.

## Blueprint recommandé
Le fichier `render.yaml` à la racine contient déjà la configuration prête (rootDir, build/start commands, healthcheck, version Python, variables d'env).
