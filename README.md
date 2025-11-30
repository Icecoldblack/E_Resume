# EasePath Job Application Assistant

EasePath is a Full Stack project (React frontend + Spring Boot backend) that helps job seekers track activity and experiment with automated job applications. The frontend gives authenticated users a dashboard, resume preview, and an "Auto Apply" form, while the backend exposes REST endpoints that scrape job boards, parse resumes, and intelligently filter job opportunities.

## Features
- **Dashboard snapshots** with quick stats for weekly applications, interviews, and AI credit usage.
- **Auto Apply workflow** that collects job keywords, job board URLs, target application counts, resume summaries, and optional PDF/DOC resumes (validated and Base64 encoded before sending to the API).
- **Smart Job Filtering**:
  - **Scan Limits**: Scans a limited number of jobs (5x requested count) to avoid excessive scraping.
  - **AI Scoring**: Ranks jobs based on resume fit and user preferences.
  - **Best Match Selection**: Automatically selects the highest-scoring candidates up to the requested count.
- **Resume Management**:
  - **PDF Parsing**: Automatically extracts text from uploaded PDF resumes using Apache PDFBox.
  - **Single Active Resume**: Enforces a "one active resume" policy by replacing old resumes upon new uploads.
- **Email Notifications**:
  - **Writing Prompt Alerts**: Notifies users via email if a job application requires manual intervention (e.g., writing prompts/assessments).
  - **Resend Integration**: Uses Resend (free tier) for reliable email delivery.
- **Google OAuth sign-in** on the landing page so users authenticate with their Gmail accounts before accessing dashboard tools.
- **Job Application API** (`POST /api/apply`) that logs the request, scrapes job listings with Jsoup, simulates AI filtering, and emails users when manual prompts are detected.
- **Extensible architecture** with placeholder hooks for AI services (configured via `easepath.ai.api-key`) and SMTP notifications via Spring Mail (configured for Resend).

## Tech Stack
- **Frontend:** React 18, TypeScript, Vite, React Router, @react-oauth/google, Axios, custom AuthContext, jwt-decode.
- **Styling:** CSS modules per page/component, dark UI system ("Aurora" theme).
- **Backend:** Java 21, Spring Boot 3.3, Spring Web, Validation, Spring Mail, Jsoup (Scraping), Apache PDFBox (PDF Parsing), Maven build.

## Repository Layout
```
E_Resume/
├── backend/                    # Spring Boot API
│   ├── pom.xml
│   └── src/main/java/com/easepath/backend/
│       ├── controller/         # JobApplication, Resume, User controllers
│       ├── dto/                # JobApplicationRequest, ResumeDto, UserDto, JobMatchResult
│       └── service/impl/       # Business logic (Scraping, PDF Parsing, Emailing)
├── frontend/                   # React + Vite client
│   ├── src/components          # Navbar, ProtectedRoute, etc.
│   └── src/pages               # Home, Dashboard, AutoApply, Settings
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Java 21 (matching `pom.xml`) and Maven 3.9+
- **Docker Desktop**: Required for running the database automatically.
- **Resend API Key**: Sign up at [Resend.com](https://resend.com) (free tier) and generate an API Key.

### 1. Clone
```bash
git clone <repo-url>
cd E_Resume
```

### 2. Backend Setup (`/backend`)
1. **Start Docker Desktop**: Ensure Docker is running on your machine.
2. Copy `src/main/resources/application.properties` to a safe location and inject your secrets. Fields to update:
   ```properties
   # Resend SMTP Configuration
   spring.mail.username=resend
   spring.mail.password=${RESEND_API_KEY}
   
   easepath.ai.api-key=YOUR_AI_SERVICE_KEY
   easepath.ai.score-endpoint=https://api.easepath.ai/v1/score
   # Database is auto-configured via Docker Compose (no change needed for local dev)
   ```
   > **Security Note:** Set `RESEND_API_KEY` as an environment variable.
3. **Run the App**:
   ```bash
   mvn spring-boot:run
   ```
   *The application will automatically detect the `compose.yaml` file in the root directory and spin up a MongoDB container for you.*
4. API defaults to `http://localhost:8080`.

### 3. Frontend Setup (`/frontend`)
1. Create a `.env` (or `.env.local`) file and add your Google OAuth client ID:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```
2. Install dependencies (include Google OAuth package):
   ```bash
   npm install
   npm install @react-oauth/google@latest
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Vite serves the app at `http://localhost:5173` (proxying to the backend via relative `/api/...` calls).

5. Install Login Background animations:
   ``` StarBorder
   npx jsrepo add https://reactbits.dev/ts/default/Animations/StarBorder
   ```
   ``` Auroua
   npx jsrepo add https://reactbits.dev/ts/default/Backgrounds/Aurora
   ```
   ```GridMotion
   npx jsrepo add https://reactbits.dev/ts/default/Backgrounds/GridMotion
   ```
   ```Split text
   npx jsrepo add https://reactbits.dev/ts/default/TextAnimations/SplitText
   ```
#### NPM scripts
| Command        | Description |
| -------------- | ----------- |
| `npm run dev`  | Launches the Vite development server with hot reloading. |
| `npm run build`| Produces a production bundle in `dist/`. |
| `npm run preview` | Serves the build output locally to verify production artifacts. |
| `npm run lint` | Runs ESLint (`@typescript-eslint`) on `src/` to enforce coding standards. |

## API Quick Reference
| Method | Endpoint                | Description |
| ------ | ----------------------- | ----------- |
| POST   | `/api/apply`            | Starts the auto-apply routine. Scrapes jobs, parses PDF resume, and scores matches. |
| POST   | `/api/resumes`          | Persists a parsed resume to MongoDB and extracts quick keywords for later querying. |
| GET    | `/api/resumes/sample`   | Returns the most recent stored resume, falling back to a mock response for UI testing. |
| POST   | `/api/users`            | Accepts a `UserDto` and echoes it back. |
| GET    | `/api/users/sample`     | Returns a sample user profile. |

`JobApplicationRequest` expects:
```json
{
  "jobTitle": "Software Engineering Intern",
  "jobBoardUrl": "https://www.linkedin.com/jobs",
  "applicationCount": 5,
  "resumeSummary": "Recent CS grad with ...",
  "resumeFileName": "resume.pdf",
  "resumeFileData": "<base64>",
  "preferredCompanies": ["Google", "Stripe"],
  "jobPreference": "full-time",
  "salaryRange": "$70k - $90k",
  "lookingForInternships": false
}
```

## Development Notes
- **PDF Parsing**: The backend now uses Apache PDFBox to extract text from uploaded resumes. This text is used for AI scoring and is persisted to the database.
- **Job Filtering**: The scraping logic now includes a "Scan Limit" to prevent infinite loops and sorts found jobs by their AI score before selecting the best matches.
- **Authentication**: Handled with Google OAuth via `@react-oauth/google`.

## Roadmap Ideas
1. Replace placeholder AI calls with a real LLM integration using `easepath.ai.api-key`.
2. Flesh out the dashboard metrics using real backend/AI scoring data.
3. Implement browser automation (Selenium/Playwright) for actual job submission (currently marks as PENDING).
