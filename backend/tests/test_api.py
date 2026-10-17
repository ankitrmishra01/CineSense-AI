from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "cinesense-backend"}

def test_recommend_validation_error():
    # Sending empty payload should fail validation
    response = client.post("/recommend", json={})
    assert response.status_code == 422
