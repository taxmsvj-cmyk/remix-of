# MKA-Core: law library brain with memory, image reading, and helper assistants

## Constraint
The `mousavitax-platform` repository uses Next.js + Python (FastAPI). Lovable can only build and run TanStack Start apps, so this project cannot edit or run those parts directly.

**Approach:** Build MKA-Core in this Lovable project as the "brain" defined in the repository's ADR-014 ("one brain, two hands"). It will follow the repository's existing contracts exactly, and its code will be pushed into a new `apps/mka-core/` folder in the same repository. No existing file will be changed, so the two codebases cannot conflict.

## Rules taken from the repository (all applied)
- One shared entry point, `POST /v1/orchestrate`, with the response `{ status, answer, citations, actions, trace_id }`.
- `status` is one of: SUCCESS, INSUFFICIENT_DATA, CLARIFICATION_REQUIRED, ERROR.
- Only MKA-Core creates citations. Helper assistants call tools but never write citations themselves.
- Assistants never touch the database directly: assistant → tool → permission check → service.
- Version 1 automation level is "Read + Suggest". Any write needs approval.
- The knowledge model follows ADR-002: SourceDocument, DocumentChunk, Citation, with validity dates and supersedes links.
- Official knowledge is kept separate from each user's case knowledge.

## Phase 1 (this build): memory and reasoning
1. **Lovable Cloud:** sign-in for multiple users, each with their own private memory.
2. **Read once, remember:** every uploaded item (image, PDF, text) or Drive file is read once. The app extracts:
   - a summary
   - the legal reasoning
   - the law articles referenced
   - links to existing articles and circulars
   
   The result is saved permanently, so later answers reuse it without re-reading the file.
3. **Image reading:** photos and scans of circulars are read by an AI vision model (Persian text extraction plus analysis).
4. **Google Drive import:** each user connects their own Drive account and picks files to import.
5. **Ask page:** answers come only from stored memory and the law library, with mandatory citations. When nothing relevant is found, the answer is INSUFFICIENT_DATA.
6. **Starter data:** the existing circulars data (about 5,400 items) is loaded into the library.

## Later phases
- **Assistant builder:** create helper assistants with a name, an instruction, and allowed tools.
- **Linking the two other apps** (law-organizer-sheets and the second preview) as helper assistants through their addresses. This needs read access to those projects, or their API addresses.

## Technical details
- **Tables:**
  - `source_documents`, `document_chunks` (with pgvector embeddings), `memory_items` (user_id, summary, reasoning, articles[], links[]), `memory_links`
  - plus the existing `books`, `articles`, `circulars`
  - RLS: official knowledge is readable by everyone; memory belongs to its owner only.
- **Server functions:** `ingestFile` (AI vision/OCR → structured extraction → embeddings), `orchestrate` (retrieval → answer with citations), and a public route `/api/public/v1/orchestrate` protected by an API key, for the Python API and bots.
- **AI:** through the Lovable AI Gateway (Gemini for vision and reasoning, plus embeddings).
- **Repository:** `apps/mka-core/` holds this app's code. `docs/adr/ADR-015-MKA-Core-Lovable.md` records the decision.
