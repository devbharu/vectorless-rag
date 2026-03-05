from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import json
import re
import sqlite3
import shutil
import os
import uuid
from typing import List, Dict
from pageindex.utils import ChatGPT_API_async
from pageindex_service import process_document
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# ------------------------------------------------
# Documents Folder Setup
# ------------------------------------------------
DOCS_DIR = "documents"  # Changed to 'documents' as requested
if not os.path.exists(DOCS_DIR):
    os.makedirs(DOCS_DIR)

# ------------------------------------------------
# Database Connection
# ------------------------------------------------
conn = sqlite3.connect(":memory:", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    file_path TEXT,
    structure TEXT
)
""")
conn.commit()

# ------------------------------------------------
# Models & Middleware
# ------------------------------------------------
class Query(BaseModel):
    question: str
    document_id: int

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------
# Search Logic
# ------------------------------------------------
def keyword_score(text: str, question_words: List[str]) -> int:
    score = 0
    text = text.lower()
    for word in question_words:
        score += len(re.findall(rf"\b{re.escape(word)}\b", text))
    return score

def collect_relevant_nodes(tree: List[Dict], question: str, top_k: int = 3):
    question_words = question.lower().split()
    matched = []
    def traverse(nodes, path=None):
        if path is None: path = []
        for node in nodes:
            title = node.get("title", "")
            summary = node.get("summary", "")
            current_path = path + [title]
            score = keyword_score(title, question_words) + keyword_score(summary, question_words)
            if score > 0:
                matched.append({"score": score, "node": node, "path": current_path})
            if "nodes" in node: traverse(node["nodes"], current_path)
    traverse(tree)
    matched.sort(key=lambda x: x["score"], reverse=True)
    return matched[:top_k]

# ------------------------------------------------
# API Endpoints
# ------------------------------------------------

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_ext = file.filename.lower().split(".")[-1]
    if file_ext not in ["pdf", "md", "markdown"]:
        return {"error": "Only PDF and Markdown files supported."}

    # Generate unique path inside 'documents' folder
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(DOCS_DIR, unique_filename)

    # Save file to local 'documents' folder
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Process the stored file
        tree_data = await process_document(file_path)
        structure = json.dumps(tree_data["structure"])

        cursor.execute(
            "INSERT INTO documents (filename, file_path, structure) VALUES (?, ?, ?)",
            (file.filename, file_path, structure)
        )
        doc_id = cursor.lastrowid
        conn.commit()

        return {"message": "Success", "document_id": doc_id}
    except Exception as e:
        if os.path.exists(file_path): 
            os.remove(file_path)
        return {"error": str(e)}

@app.get("/documents/{doc_id}/preview")
async def get_document_preview(doc_id: int):
    cursor.execute("SELECT file_path, filename FROM documents WHERE id = ?", (doc_id,))
    row = cursor.fetchone()
    
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = row[0]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File missing on disk")

    # Serves the file from the 'documents' folder
    return FileResponse(file_path, filename=row[1])

@app.post("/ask")
async def ask(query: Query):
    cursor.execute("SELECT structure FROM documents WHERE id = ?", (query.document_id,))
    row = cursor.fetchone()
    if not row: return {"answer": "Document not found."}

    tree = json.loads(row[0])
    relevant_nodes = collect_relevant_nodes(tree, query.question)
    if not relevant_nodes: return {"answer": "No relevant context found."}

    context = "\n\n".join([f"Path: {' > '.join(n['path'])}\nTitle: {n['node']['title']}\nSummary: {n['node'].get('summary', '')}" for n in relevant_nodes])
    
    prompt = f"Use ONLY the following context to answer.\n\nContext:\n{context}\n\nQuestion:\n{query.question}"
    answer = await ChatGPT_API_async(model="gpt-oss:120b-cloud", prompt=prompt)
    return {"answer": answer}

@app.get("/documents")
def list_documents():
    cursor.execute("SELECT id, filename FROM documents")
    return [{"id": d[0], "filename": d[1]} for d in cursor.fetchall()]