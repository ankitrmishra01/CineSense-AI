# CineSense AI — Hosting Architecture Comparison & Evaluation

**Date:** October 18, 2026  
**Backend:** FastAPI + SQLAlchemy Async + FastEmbed ONNX + FAISS Index (5,170 vectors)  
**Database:** Neon Serverless PostgreSQL  
**Frontend:** Vercel (React 19 + TypeScript + Vite)  

---

## 1. Hosting Options Comparison Table

| Metric / Feature | Render Free Tier *(Current)* | Render Starter Tier | Azure App Service (B1 Linux) | Azure Container Apps (Consumption) |
|---|---|---|---|---|
| **RAM Allocation** | 512 MB | 512 MB | 1.75 GB | 0.5 GB – 4.0 GB (Configurable) |
| **vCPU** | 0.1 – 0.5 Shared | 0.5 Shared | 1 Dedicated Core | 0.25 – 2.0 vCPU |
| **New ONNX Peak RAM (295.2 MB)** | **Fits (218 MB headroom)** | **Fits comfortably** | **Abundant headroom (1.45 GB)** | **Fits perfectly at 0.75–1.0 GB** |
| **Idle Behavior** | Spins down after 15 min idle | Always on | Always on | Scales to 0 instances (or min=1) |
| **Cold Start Latency** | 30 – 50 seconds | 0 seconds (Always on) | 0 seconds (Always on) | 5 – 12 seconds from zero |
| **Free Monthly Quota** | 750 hours/month pool | N/A | None (Free F1 lacks 1GB RAM) | 180,000 vCPU-seconds / month |
| **Monthly Cost Range** | **$0 / month** | **$7.00 / month** | **~$13.00 – $14.50 / month** | **$0 – $5.00 / month** (traffic dependent) |
| **Deployment Mechanism** | Git push / Docker | Git push / Docker | Container Registry (ACR) / Git | Azure Container Registry (ACR) |
| **Health Check Support** | Yes (`/health`) | Yes (`/health`) | Yes (`/health`) | Yes (Liveness & Readiness probes) |

*Note: Pricing and quotas should be verified on provider websites.*

---

## 2. In-Depth Provider Evaluation

### Option 1: Render Free Tier *(Status: Viable with New FastEmbed ONNX Engine)*
- **Pros:** Completely free ($0/mo); supports git-push auto-deploy; native HTTPS.
- **Cons:** Spins down after 15 minutes of inactivity resulting in 30–50s cold starts.
- **Verdict:** With the new FastEmbed ONNX engine dropping peak RSS to **295.2 MB**, the backend will no longer crash or OOM on the free tier. Uptime pinging every 10 minutes can keep it warm during active hours.

### Option 2: Render Starter Tier ($7/mo)
- **Pros:** Always-on (zero cold starts); no sleep after 15 min; instant response times for users.
- **Cons:** Paid ($7/month).
- **Verdict:** The simplest upgrade path if cold starts become objectionable. No code or architecture changes needed.

### Option 3: Azure App Service — Linux Basic (B1) (~$13/mo)
- **Pros:** 1.75 GB RAM (generous headroom); 1 dedicated vCPU; production-grade SLA; custom domains and SSL.
- **Cons:** Highest cost of the 4 options; slightly more complex initial deployment via Azure CLI / ACR.
- **Verdict:** Solid production choice for enterprise stability and dedicated compute.

### Option 4: Azure Container Apps — Consumption Tier ($0–$5/mo)
- **Pros:** Serverless container pricing (pay only per millisecond of compute); first 180,000 vCPU-sec and 360,000 GiB-sec are free every month; can be configured with `minReplicas=1` for always-on, or `minReplicas=0` for maximum cost savings.
- **Cons:** Requires pushing Docker image to Azure Container Registry (ACR).
- **Verdict:** Best balance of cost and performance for cloud-native Docker deployments.

---

## 3. Instance Hours & Bandwidth Analysis

- **Instance Hours:** 750 free hours/month on Render covers a single 24/7 service if kept continuously warm ($720\text{ hours/month} \le 750$).
- **Bandwidth Reduction:**
  - FastEmbed responses are trimmed (only essential movie fields returned on cards).
  - W3C Server-Timing headers add minimal overhead (<80 bytes).
  - Posters use TMDB `w500` sizing, keeping client bandwidth light.
