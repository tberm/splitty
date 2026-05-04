# Stack
- DB: PostgreSQL
- Backend app: FastAPI
- Mobile app: Expo

# Approach
- We will start with developing the backend using test-driven development
- Tests will be end-to-end tests written in pytest, testing the API and simulating entire user flows.
- API implementation will start code-first and then export an OpenAPI doc which
  will be treated as contract. Then work can continue on both sides of API at
  once.
- The backend will implemented by LLM agents using the tests as a reference for behaviour.
- Frontend (Expo) will be implemented by LLM agents initially using mock server based on the OpenAPI doc.