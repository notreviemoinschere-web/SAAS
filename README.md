# PrizeWheel Pro – Backend deployment notes (Render)

## Configuration Render prête à copier-coller

### Build Command
```bash
pip install -r requirements.txt
```

### Start Command
```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

### Root Directory
```text
backend
```

### Variables d'environnement minimales
- `MONGO_URL` **ou** `MONGODB_URI`
- `DB_NAME` (optionnel si le nom de base est déjà présent dans l'URI Mongo)
- `JWT_SECRET`
- `SUPER_ADMIN_PASSWORD`
- `DEMO_TENANT_PASSWORD`

## Option recommandée: Blueprint Render
Ce repo contient aussi `render.yaml` à la racine. Vous pouvez connecter le repo en mode Blueprint pour éviter les erreurs de saisie de commandes/variables.
