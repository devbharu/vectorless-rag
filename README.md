  

---

# 📄 `README.md`

```markdown
# 🚀 Vectorless RAG API

A lightweight **Vectorless Retrieval-Augmented Generation (RAG)** backend built with FastAPI.

This project enables:
- 📂 Uploading PDF / Markdown documents
- 🧠 Structured document parsing
- 🔍 Keyword-based retrieval (no vector DB required)
- 🤖 Context-grounded question answering
- 📄 Document preview API

---

## 🧠 What is Vectorless RAG?

Unlike traditional RAG systems that rely on vector databases and embeddings,  
this implementation uses structured document trees + keyword scoring for retrieval.

This makes it:
- ⚡ Lightweight
- 💰 Cost-effective
- 🧩 Easy to deploy
- 🛠 Beginner-friendly

---

# 🛠 Tech Stack

- FastAPI
- SQLite (In-memory)
- Python
- Async LLM API Integration
- CORS Enabled

---

# 📁 Project Structure

 

vectorless-rag/
│
├── main.py
├── pageindex_service.py
├── pageindex/
│
├── documents/        # Uploaded files stored here
├── logs/
├── config.yaml
├── requirements.txt
└── README.md

 ```

---

# 🚀 Getting Started

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/devbharu/vectorless-rag.git
cd vectorless-rag
````

---

## 2️⃣ Create Virtual Environment

```bash
python -m venv .venv
```

### Activate:

**Mac/Linux**

```bash
source .venv/bin/activate
```

**Windows**

```bash
.venv\Scripts\activate
```

---

## 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 4️⃣ Run the Server

```bash
uvicorn main:app --reload
```

Server runs at:

```
http://127.0.0.1:8000
```

---

# 📘 API Documentation

After starting the server, open:

```
http://127.0.0.1:8000/docs
```

Interactive Swagger UI available for testing endpoints.

---

# 📂 API Endpoints

---

## 📤 Upload Document

**POST** `/upload`

Upload PDF or Markdown file.

Supported formats:

* `.pdf`
* `.md`
* `.markdown`

Response:

```json
{
  "message": "Success",
  "document_id": 1
}
```

---

## 📄 List Documents

**GET** `/documents`

Returns all uploaded documents.

---

## 🔍 Preview Document

**GET** `/documents/{doc_id}/preview`

Returns the original uploaded file.

---

## 🤖 Ask Question

**POST** `/ask`

Request:

```json
{
  "question": "What is RAG?",
  "document_id": 1
}
```

Response:

```json
{
  "answer": "..."
}
```

The model uses only retrieved document context to answer.

---

# 🔎 How Retrieval Works

1. Document is parsed into structured tree.
2. Titles + summaries are stored.
3. Keyword scoring is applied.
4. Top matching nodes are selected.
5. Context injected into LLM prompt.
6. Model generates grounded answer.

No embeddings.
No vector database.
Fully structured retrieval.

---

# ⚠️ Important Notes

* Database is in-memory (`:memory:`).
* All documents reset when server restarts.
* To persist data, switch to file-based SQLite.

Example:

```python
sqlite3.connect("documents.db")
```

---

# 📦 Requirements

```
fastapi
uvicorn[standard]
pydantic
python-multipart
aiofiles
pyyaml
```

---

# 🧪 Run on Custom Port

```bash
uvicorn main:app --reload --port 9000
```

---

# 📌 Future Improvements

* Persistent database
* Hybrid retrieval
* Semantic reranking
* Streaming responses
* Docker deployment

---

# 👨‍💻 Author

Devbharu

---

# ⭐ If You Like This Project

Star the repo and contribute 🚀

  
