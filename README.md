# PrizeWheel Pro – Backend deployment notes (Render)

## Pourquoi ton build casse
Le log montre que Render construit avec **Python 3.14** (`.../.venv/bin/python3.14`).
Avec ce runtime, `pydantic-core` essaye de compiler en Rust (`maturin`) au lieu d'utiliser une wheel précompilée, puis échoue sur le filesystem read-only.

## Configuration Render prête à copier-coller

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

### Version Python (important)
```text
3.12.9
```

Tu peux la définir:
- via la variable d'environnement `PYTHON_VERSION=3.12.9`
- ou via le fichier `.python-version` (déjà ajouté dans ce repo)

### Variables d'environnement minimales
- `MONGO_URL` **ou** `MONGODB_URI` (tu peux renseigner les deux; l'app prend le premier disponible)
- `DB_NAME` (optionnel si le nom de base est déjà présent dans l'URI Mongo)
- `JWT_SECRET`
- `SUPER_ADMIN_PASSWORD`
- `DEMO_TENANT_PASSWORD`

## Option recommandée: Blueprint Render
Ce repo contient `render.yaml` à la racine avec les valeurs déjà prêtes (rootDir, commandes, health check, Python version, env vars).


### Option anti-build source (recommandé)
- `PIP_PREFER_BINARY=1` pour privilégier les wheels précompilées pendant `pip install`.
