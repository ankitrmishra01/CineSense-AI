# CineSense AI — Optional Azure Migration Guide & Runbook

**Purpose:** Complete manual step-by-step procedure to migrate or mirror the CineSense AI backend to Azure (App Service or Azure Container Apps) while keeping Render online as a fallback.

---

## 1. Prerequisites
- An active Azure subscription.
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed locally (`az --version`).
- Docker Desktop running locally.

---

## 2. Phase 1: Build & Push Docker Image to Azure Container Registry (ACR)

1. **Log in to Azure:**
   ```bash
   az login
   ```

2. **Create a Resource Group:**
   ```bash
   az group create --name rg-cinesense --location eastus
   ```

3. **Create an Azure Container Registry (Basic SKU):**
   ```bash
   az acr create --resource-group rg-cinesense --name cinesenseacr --sku Basic --admin-enabled true
   ```

4. **Log in to the Registry:**
   ```bash
   az acr login --name cinesenseacr
   ```

5. **Build and Tag the Production Docker Image:**
   ```bash
   cd backend
   docker build -t cinesenseacr.azurecr.io/cinesense-backend:v1 .
   ```

6. **Push Image to ACR:**
   ```bash
   docker push cinesenseacr.azurecr.io/cinesense-backend:v1
   ```

---

## 3. Phase 2: Deploy to Azure App Service (Option A: B1 Basic)

1. **Create an App Service Plan (Linux B1):**
   ```bash
   az appservice plan create \
     --name plan-cinesense \
     --resource-group rg-cinesense \
     --sku B1 \
     --is-linux
   ```

2. **Create the Web App with the Container:**
   ```bash
   az webapp create \
     --resource-group rg-cinesense \
     --plan plan-cinesense \
     --name cinesense-api \
     --deployment-container-image-name cinesenseacr.azurecr.io/cinesense-backend:v1
   ```

3. **Configure Environment Variables (Application Settings):**
   ```bash
   az webapp config appsettings set --resource-group rg-cinesense --name cinesense-api --settings \
     WEBSITES_PORT=8000 \
     DATABASE_URL="<YOUR_NEON_POSTGRES_ASYNC_URL>" \
     SYNC_DATABASE_URL="<YOUR_NEON_POSTGRES_SYNC_URL>" \
     GROQ_API_KEY="<YOUR_GROQ_KEY>" \
     TMDB_API_KEY="<YOUR_TMDB_KEY>" \
     JWT_SECRET_KEY="<YOUR_JWT_SECRET>" \
     CORS_ORIGINS="https://cine-sense-ai.vercel.app" \
     FAISS_INDEX_PATH="faiss_index/movies.index" \
     FAISS_ID_MAP_PATH="faiss_index/id_map.json"
   ```

4. **Set Up Health Check Path:**
   ```bash
   az webapp config set --resource-group rg-cinesense --name cinesense-api --health-check-path /health
   ```

---

## 4. Phase 3: Verification & Traffic Cutover

1. **Test Azure Backend Directly:**
   ```bash
   curl -i https://cinesense-api.azurewebsites.net/health
   curl -i https://cinesense-api.azurewebsites.net/health/detailed
   ```
   Confirm response: `{"status": "ok", "service": "cinesense-backend"}` in <100ms.

2. **Verify Discovery Recommendation:**
   ```bash
   curl -X POST https://cinesense-api.azurewebsites.net/recommend \
     -H "Content-Type: application/json" \
     -d '{"mood_text": "cozy warm comfort film", "limit": 5, "page": 1}'
   ```

3. **Update Vercel Frontend Environment Variable:**
   - In Vercel Project Settings $\rightarrow$ Environment Variables:
     - Update `VITE_API_URL` to `https://cinesense-api.azurewebsites.net`.
   - Redeploy Vercel.

---

## 5. Rollback Plan

If any issue arises with Azure:
1. Render backend remains running undisturbed throughout the migration.
2. In Vercel Project Settings, revert `VITE_API_URL` back to the Render URL (`https://cinesense-ai.onrender.com`).
3. Redeploy Vercel. Full traffic reverts back to Render in under 60 seconds.
