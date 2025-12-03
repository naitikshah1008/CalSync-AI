from fastapi import FastAPI
import requests
from pydantic import BaseModel

app = FastAPI()

OLLAMA_URL = "http://calsync-ollama:11434/api/generate"

class LLMRequest(BaseModel):
    prompt: str

@app.get("/health")
def health():
    return {"status": "brain container running"}

@app.post("/test-llm")
def test_llm(req: LLMRequest):
    payload = {
        "model": "llama3.2:3b",
        "prompt": req.prompt,
        "stream": False
    }
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        return {
            "status": "ok",
            "response": data.get("response", "")
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
