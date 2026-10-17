from fastapi.testclient import TestClient
from app.main import app
from app.schemas.recommend import ExplainRequest, ExplainResponse
from app.schemas.movie import MovieOut

client = TestClient(app)

def test_detailed_health_check():
    response = client.get("/health/detailed")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["service"] == "cinesense-backend"
    assert "database" in data
    assert "faiss" in data

def test_explain_schemas():
    req = ExplainRequest(movie_id=550, query_text="psychological thriller with dual identity")
    assert req.movie_id == 550
    assert "psychological" in req.query_text

    res = ExplainResponse(movie_id=550, explanation="A profound examination of identity and rebellion.")
    assert res.movie_id == 550
    assert len(res.explanation) > 0

def test_similar_movies_route_registered():
    routes = [route.path for route in app.routes]
    assert "/movies/{movie_id}/similar" in routes
