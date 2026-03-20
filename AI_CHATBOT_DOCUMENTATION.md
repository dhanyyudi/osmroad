# Dokumentasi Sistem AI Chatbot - Dhanypedia Portfolio

## 📋 Overview

Sistem AI Chatbot pada portfolio ini adalah **AI Assistant** yang menggunakan **Google Vertex AI dengan model Gemini 2.5 Flash** untuk menjawab pertanyaan pengunjung tentang profil, proyek, keahlian, dan pengalaman Dhany Yudi Prasetyo. Chatbot ini dirancang dengan fitur **anti-hallucination guardrails** untuk memastikan semua jawaban akurat dan berdasarkan data portfolio yang tersimpan di database.

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     ChatWidget.tsx (React Component)                 │    │
│  │  • UI Chat Interface (Glassmorphism Design)                         │    │
│  │  • State Management (messages, loading, input)                      │    │
│  │  • Auto-open animation & Scroll/Map interaction handling            │    │
│  │  • Language Localization (EN/ID)                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ POST /api/chat
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER (Next.js API Route)                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      app/api/chat/route.ts                           │    │
│  │  • Request Validation                                               │    │
│  │  • Portfolio Context Aggregation (from Supabase)                    │    │
│  │  • Prompt Engineering dengan Anti-Hallucination Guardrails          │    │
│  │  • Google Vertex AI Integration (Gemini 2.5 Flash)                  │    │
│  │  • Response Validation & Metadata                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
┌──────────────────────────┐              ┌──────────────────────────┐
│      SUPABASE DATABASE    │              │   GOOGLE VERTEX AI       │
│  ┌────────────────────┐  │              │  ┌────────────────────┐  │
│  │ • about            │  │              │  │  Gemini 2.5 Flash  │  │
│  │ • projects         │  │              │  │  Model             │  │
│  │ • skills           │  │              │  │                    │  │
│  │ • experience       │  │              │  │  • Text Generation │  │
│  │ • education        │  │              │  │  • Context-aware   │  │
│  └────────────────────┘  │              │  └────────────────────┘  │
└──────────────────────────┘              └──────────────────────────┘
```

---

## 🛠️ Teknologi yang Digunakan

### 1. AI/ML Platform
| Komponen | Teknologi | Versi | Deskripsi |
|----------|-----------|-------|-----------|
| AI Model | Google Vertex AI | - | Cloud-based AI platform |
| LLM | Gemini 2.5 Flash | latest | Model bahasa untuk generate response |
| SDK | `@google-cloud/vertexai` | ^1.10.0 | Vertex AI client library |
| Alternative | `@google/generative-ai` | ^0.24.1 | Direct Gemini API (backup) |

### 2. Frontend Stack
| Komponen | Teknologi | Deskripsi |
|----------|-----------|-----------|
| Framework | Next.js 16.1.1 | React framework dengan App Router |
| Language | TypeScript | Type-safe development |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Animation | Framer Motion | Smooth UI animations |
| Icons | Lucide React | Modern icon library |

### 3. Database & Backend
| Komponen | Teknologi | Deskripsi |
|----------|-----------|-----------|
| Database | Supabase (PostgreSQL) | Data portfolio storage |
| SDK | `@supabase/supabase-js` | Database client |

---

## 💬 Komponen Frontend: ChatWidget.tsx

### Lokasi File
```
src/components/ChatWidget.tsx
```

### Fitur Utama

#### 1. **State Management**
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const [isOpen, setIsOpen] = useState(false);
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [isLoading, setIsLoading] = useState(false);
```

#### 2. **Auto-Open Behavior**
- Chat widget secara otomatis terbuka setelah **1 detik** saat halaman dimuat
- Menggunakan `useEffect` dengan delay untuk smooth entrance animation

#### 3. **Smart Auto-Close**
Chat akan otomatis menutup saat:
- **User scroll** lebih dari 50px dari atas
- **User mengklik map** (MapLibre GL canvas atau marker)

```typescript
useEffect(() => {
  const handleScroll = () => {
    if (window.scrollY > 50) {
      setIsOpen(false);
    }
  };

  const handleMapClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.maplibregl-map') || target.closest('.maplibregl-canvas')) {
      setIsOpen(false);
    }
  };
}, [isOpen]);
```

#### 4. **Message Handling**
```typescript
const sendMessage = async () => {
  // 1. Add user message to state
  // 2. POST ke /api/chat dengan message
  // 3. Receive AI response
  // 4. Add assistant message to state
  // 5. Handle errors (rate limit, network, etc.)
};
```

#### 5. **Rate Limit Handling**
```typescript
const isRateLimit = errorMsg.includes('429') || 
                    errorMsg.includes('quota') || 
                    errorMsg.includes('Too Many Requests') || 
                    response.status === 429;

// Error message khusus untuk rate limit
'⏳ Maaf, API sedang sibuk. Silakan coba lagi dalam 1 menit. (Rate limit reached)'
```

#### 6. **UI Design (Glassmorphism)**
- **Position**: Fixed bottom-right (bottom-28 right-6)
- **Size**: 380px width x 500px height
- **Style**: Glass-card dengan backdrop blur
- **Colors**: Menggunakan CSS variables untuk dark/light theme

```css
/* Chat-specific CSS Variables */
--chat-user-text: #ffffff;
--chat-assistant-bg: #1e293b;
--chat-assistant-text: #f8fafc;
--chat-assistant-border: #334155;
--chat-subtitle-text: #94a3b8;
--chat-input-bg: #0f172a;
--chat-input-border: #334155;
--chat-input-text: #f8fafc;
--chat-input-placeholder: #64748b;
```

---

## 🔧 API Backend: app/api/chat/route.ts

### Lokasi File
```
src/app/api/chat/route.ts
```

### Arsitektur Endpoint

#### 1. **Portfolio Context Aggregation**
Fungsi `getPortfolioContext()` mengumpulkan data dari **5 tabel** Supabase:

```typescript
async function getPortfolioContext(): Promise<{
  context: string;
  lastUpdated: string;
  dataCompleteness: number;
}> {
  // 1. Fetch About data (profile, summary)
  // 2. Extract Skills (embedded dalam about)
  // 3. Extract Experience (embedded dalam about)
  // 4. Extract Education (embedded dalam about)
  // 5. Fetch ALL visible Projects dengan detail lengkap
}
```

**Data yang Dikumpulkan:**

| Sumber | Field | Deskripsi |
|--------|-------|-----------|
| `about` | name, title, location, summary | Profil dasar |
| `about.skills` | category, items | Keahlian teknis |
| `about.experience` | role, company, period, description | Riwayat kerja |
| `about.education` | degree, institution, year | Pendidikan |
| `projects` | title, description, year, location, tech_stack, impacts | Semua proyek |

#### 2. **Vertex AI Initialization**
```typescript
// Support Vercel deployment dengan Service Account JSON
let authOptions = undefined;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  authOptions = { credentials };
}

const vertexAI = new VertexAI({
  project: projectId,
  location: location, // default: 'us-central1'
  googleAuthOptions: authOptions
});

const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
```

#### 3. **Advanced Prompt Engineering**
Prompt terdiri dari **6 bagian guardrails** kritis:

```
===================
CRITICAL GUARDRAILS
===================
1. ANTI-HALLUCINATION RULES
2. DATA FRESHNESS
3. RESPONSE CONSISTENCY
4. SCOPE LIMITATIONS
5. LANGUAGE HANDLING
6. VERIFICATION & ACCURACY

===================
PORTFOLIO DATA
===================
[Aggregated data from Supabase]

===================
DATA VALIDATION SUMMARY
===================
- Data Freshness: [timestamp]
- Completeness: [%]
- Total Projects Loaded: [N]

===================
USER QUESTION
===================
[User message]
```

#### 4. **Anti-Hallucination Guardrails**

| Rule | Implementasi |
|------|-------------|
| **Only Use Portfolio Data** | "ONLY use information from the PORTFOLIO DATA section" |
| **Admit Unknown** | Jika tidak ada data: "I don't have that specific information... contact Dhany directly" |
| **No Assumption** | "NEVER make up project details, dates, technologies..." |
| **Cite Sources** | Gunakan frasa "According to the portfolio..." |
| **Exact Values** | Gunakan nama, tanggal, judul persis dari data |
| **Scope Limit** | Hanya jawab tentang Dhany & portfolio GIS |

#### 5. **Response Validation**
```typescript
const hallucinationPatterns = [
  /I think|I believe|probably|maybe|it might be|could be/gi,
  /based on my (knowledge|understanding)/gi,
  /as far as I (know|understand)/gi
];

// Jika pattern ditemukan, tambahkan warning di metadata
return NextResponse.json({ 
  response: text,
  metadata: {
    dataFreshness: lastUpdated,
    dataCompleteness: `${dataCompleteness.toFixed(0)}%`,
    warning: hasWarning ? 'Response may contain uncertain information' : null,
    timestamp: new Date().toISOString()
  }
});
```

---

## 🗄️ Database Schema

### Tabel yang Digunakan Chatbot

#### 1. **about** - Profil Owner
```sql
CREATE TABLE about (
  id UUID PRIMARY KEY,
  name VARCHAR,
  title VARCHAR,
  summary TEXT,
  skills JSONB,      -- [{category, items: []}]
  experience JSONB,  -- [{role, company, period, description}]
  education JSONB,   -- [{degree, institution, year}]
  updated_at TIMESTAMP
);
```

#### 2. **projects** - Daftar Proyek
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  title VARCHAR,
  description TEXT,
  year INTEGER,
  location_name VARCHAR,
  location JSONB,    -- {lat, lng}
  tech_stack TEXT[],
  impacts TEXT[],
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🔐 Environment Variables

### Variabel Wajib untuk Chatbot

```bash
# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Vertex AI
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_LOCATION=us-central1  # optional, default: us-central1

# Google Service Account (untuk Vercel deployment)
# JSON format dari service account key
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### Pengaturan Autentikasi Google

**Option 1: Local Development**
```bash
# Gunakan Application Default Credentials (ADC)
gcloud auth application-default login
```

**Option 2: Vercel Deployment**
```bash
# Service Account JSON di environment variable
echo $GOOGLE_SERVICE_ACCOUNT_JSON | base64 -d
```

---

## 🤖 Vertex AI Technical Implementation

Bagian ini menjelaskan secara teknis bagaimana Google Vertex AI diimplementasikan dalam project ini, mulai dari setup awal hingga deployment.

### 1. Setup Awal Google Cloud Project

#### Step 1: Create New Project (atau gunakan existing)
```bash
# Login ke Google Cloud
gcloud auth login

# List existing projects
gcloud projects list

# Create new project (jika belum punya)
gcloud projects create PROJECT_ID --name="Project Name"

# Set project aktif
gcloud config set project PROJECT_ID
```

#### Step 2: Enable Vertex AI API
```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Enable juga API terkait (recommended)
gcloud services enable cloudresourcemanager.googleapis.com
```

#### Step 3: Setup Billing
- Masuk ke [Google Cloud Console](https://console.cloud.google.com)
- Navigasi ke **Billing**
- Link project ke billing account (Vertex AI memerlukan billing yang aktif)
- **Cost Estimate**: Gemini 2.5 Flash ~$0.15-0.30 per 1M tokens (input+output)

---

### 2. Service Account Setup & Authentication

Service Account adalah identitas aplikasi yang digunakan untuk mengakses Google Cloud resources. **Ya, setiap project memerlukan service account sendiri** (atau menggunakan default compute service account).

#### Option A: Create New Service Account (Recommended untuk production)

```bash
# 1. Create service account
gcloud iam service-accounts create portfolio-ai \
    --display-name="Portfolio AI Service Account" \
    --description="Service account for Vertex AI chatbot"

# 2. Get service account email
export SA_EMAIL="portfolio-ai@PROJECT_ID.iam.gserviceaccount.com"

# 3. Assign roles (permission)
# Role untuk Vertex AI
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/aiplatform.user"

# Role untuk logging (optional tapi recommended)
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/logging.logWriter"

# 4. Create dan download key (JSON)
gcloud iam service-accounts keys create ~/portfolio-ai-key.json \
    --iam-account=$SA_EMAIL \
    --key-file-type=json
```

#### Option B: Use Default Service Account (Development only)

```bash
# Untuk local development, bisa menggunakan Application Default Credentials (ADC)
gcloud auth application-default login

# Ini akan menyimpan credentials di:
# - Windows: %APPDATA%\gcloud\application_default_credentials.json
# - Mac/Linux: ~/.config/gcloud/application_default_credentials.json
```

**⚠️ Warning**: Default ADC hanya berfungsi di local development. Untuk production (Vercel, etc), wajib menggunakan Service Account JSON.

---

### 3. Memilih & Menggunakan Model

#### Model yang Tersedia di Vertex AI

| Model | Versi | Use Case | Harga (per 1M tokens) |
|-------|-------|----------|----------------------|
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | Chatbot, fast responses | ~$0.15 input, ~$0.30 output |
| Gemini 1.5 Pro | `gemini-1.5-pro` | Complex reasoning | ~$3.50 input, ~$10.50 output |
| Gemini 1.5 Flash | `gemini-1.5-flash` | Balanced speed/quality | ~$0.35 input, ~$1.05 output |
| Gemini 1.0 Pro | `gemini-1.0-pro` | Legacy support | ~$0.50 input, ~$1.50 output |

#### Mengapa Gemini 2.5 Flash?

```typescript
// File: src/app/api/chat/route.ts
const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
```

**Alasan pemilihan:**
1. **Speed** - Response time < 2 detik untuk prompt panjang
2. **Cost-effective** - 10x lebih murah dari Pro model
3. **Context Window** - Mendukung hingga 1M tokens (cukup untuk portfolio context)
4. **Quality** - Cukup baik untuk question-answering dengan context

#### Cara Mengganti Model

```typescript
// Ganti ke model lain
const model = vertexAI.getGenerativeModel({ 
  model: 'gemini-1.5-pro',  // Upgrade untuk reasoning kompleks
  // atau
  model: 'gemini-1.5-flash', // Model stable
});
```

---

### 4. SDK Implementation Detail

#### 4.1 Install SDK

```bash
npm install @google-cloud/vertexai
```

#### 4.2 Initialize Client

```typescript
import { VertexAI } from '@google-cloud/vertexai';

// Detect environment dan setup auth
function initializeVertexAI() {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  const location = process.env.GOOGLE_LOCATION || 'us-central1';
  
  if (!projectId) {
    throw new Error('GOOGLE_PROJECT_ID is required');
  }

  // Option 1: Vercel/Production dengan Service Account JSON
  let authOptions = undefined;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      authOptions = { credentials };
    } catch (e) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e);
    }
  }

  // Option 2: Local dengan ADC (authOptions akan undefined, SDK menggunakan default)
  const vertexAI = new VertexAI({
    project: projectId,
    location: location,
    googleAuthOptions: authOptions  // undefined = use ADC
  });

  return vertexAI;
}
```

#### 4.3 Generate Content (Basic)

```typescript
const vertexAI = initializeVertexAI();
const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Simple text generation
const result = await model.generateContent('Hello, how are you?');
const response = await result.response;
const text = response.candidates?.[0].content.parts[0].text;
```

#### 4.4 Generate Content dengan System Instruction (Advanced)

```typescript
// Setup model dengan system instruction
const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: {
    role: 'system',
    parts: [{ text: 'You are a helpful AI assistant for a GIS portfolio website.' }]
  }
});

// Kirim prompt dengan context
const chat = model.startChat({
  history: [
    { role: 'user', parts: [{ text: 'Context: ...' }] },
    { role: 'model', parts: [{ text: 'Understood.' }] }
  ]
});

const result = await chat.sendMessage('What projects are there?');
```

#### 4.5 Streaming Response (Real-time)

```typescript
// Untuk UX yang lebih baik (response muncul per kata)
const streamingResp = await model.generateContentStream(prompt);

for await (const item of streamingResp.stream) {
  const chunkText = item.candidates?.[0].content.parts[0].text;
  // Kirim chunk ke client via WebSocket/SSE
}
```

---

### 5. Execute Flow (End-to-End)

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXECUTE FLOW                             │
└─────────────────────────────────────────────────────────────────┘

1. USER REQUEST
   └── User mengetik: "What GIS projects has Dhany done?"
       
2. FRONTEND (ChatWidget.tsx)
   ├── Add message ke UI state
   ├── POST /api/chat dengan JSON body
   └── { message: "What GIS projects has Dhany done?" }
       
3. API ROUTE (app/api/chat/route.ts)
   ├── Validate request
   ├── Fetch portfolio context dari Supabase
   │   └── Query: about, projects, skills, experience, education
   ├── Build comprehensive prompt
   │   └── Guardrails + Context + User Question
   ├── Initialize Vertex AI
   │   ├── Check GOOGLE_SERVICE_ACCOUNT_JSON
   │   ├── Parse JSON credentials
   │   └── Create VertexAI instance
   ├── Call model.generateContent(prompt)
   │   └── HTTP request ke Vertex AI API
   ├── Receive response dari Google
   ├── Validate response (anti-hallucination check)
   └── Return JSON dengan response + metadata
       
4. FRONTEND UPDATE
   ├── Receive response
   ├── Add AI message ke UI state
   └── Render dengan animation
```

---

### 6. Deployment Preparation

#### 6.1 Environment Variables untuk Deployment

**Untuk Vercel (Production)**:
```bash
# 1. Copy isi service account key file
# Format: cat ~/portfolio-ai-key.json | pbcopy (Mac) atau clip (Windows)

# 2. Add ke Vercel Environment Variables
vercel env add GOOGLE_PROJECT_ID
vercel env add GOOGLE_SERVICE_ACCOUNT_JSON  # Paste JSON lengkap

# 3. Deploy
vercel --prod
```

**Via Vercel Dashboard**:
1. Go to Project → Settings → Environment Variables
2. Add `GOOGLE_PROJECT_ID` = your-project-id
3. Add `GOOGLE_SERVICE_ACCOUNT_JSON` = [paste entire JSON content]

#### 6.2 Service Account untuk Project Lain

**Pertanyaan**: *"Untuk project lain, apakah perlu create service account sendiri?"*

**Jawaban**: **YA**, setiap project sebaiknya memiliki service account sendiri. Berikut pilihannya:

| Option | Kapan Digunakan | Cara |
|--------|-----------------|------|
| **New Service Account** | **Recommended** - Production apps | Create baru via gcloud console/CLI |
| **Existing SA** | Hanya untuk development/testing | Share key (tidak recommended) |
| **Default Compute SA** | VM/App Engine di GCP | Automatic, tidak perlu setup |

**Best Practice untuk Multiple Projects**:
```bash
# Project A (Portfolio Website)
portfolio-ai@project-a.iam.gserviceaccount.com
  └── Role: aiplatform.user (project-a only)

# Project B (Mobile App)
mobile-ai@project-b.iam.gserviceaccount.com
  └── Role: aiplatform.user (project-b only)
```

**Alasan memisahkan service account:**
1. **Security** - Isolation jika satu key bocor
2. **Permission Control** - Tiap project bisa punya permission berbeda
3. **Monitoring** - Tracking cost per project lebih mudah
4. **Rotation** - Rotate key satu project tanpa affect project lain

---

### 7. Testing & Debugging

#### 7.1 Local Testing dengan ADC

```bash
# 1. Login
gcloud auth application-default login

# 2. Set project
gcloud config set project YOUR_PROJECT_ID

# 3. Run dev server
npm run dev

# 4. Test dengan curl
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Test message"}'
```

#### 7.2 Local Testing dengan Service Account

```bash
# 1. Set environment variable
export GOOGLE_SERVICE_ACCOUNT_JSON=$(cat ~/portfolio-ai-key.json)
export GOOGLE_PROJECT_ID=your-project-id

# 2. Run dev
npm run dev
```

#### 7.3 Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `403 Permission denied` | Service account tidak punya role | Add role `aiplatform.user` |
| `401 Invalid credentials` | JSON key corrupt/expired | Generate key baru |
| `429 Quota exceeded` | Rate limit API | Tunggu atau request quota increase |
| `400 Invalid argument` | Model name salah | Cek nama model: `gemini-2.5-flash` |
| `Location not found` | Region tidak support | Ganti ke `us-central1` |

#### 7.4 Logging & Monitoring

```typescript
// Tambahkan logging di API route
console.log('Vertex AI Request:', {
  projectId: process.env.GOOGLE_PROJECT_ID,
  location: process.env.GOOGLE_LOCATION,
  promptLength: prompt.length,
  timestamp: new Date().toISOString()
});

console.log('Vertex AI Response:', {
  responseLength: text?.length,
  latency: Date.now() - startTime,
  timestamp: new Date().toISOString()
});
```

**Di Google Cloud Console**:
- **Cloud Logging**: Lihat request/response logs
- **Cloud Monitoring**: Track quota usage dan latency
- **Billing**: Monitor cost breakdown

---

### 8. Security Best Practices

#### 8.1 Service Account Security
```bash
# 1. Rotate keys secara berkala (3-6 bulan)
gcloud iam service-accounts keys list --iam-account=$SA_EMAIL
gcloud iam service-accounts keys create ~/new-key.json --iam-account=$SA_EMAIL
# Delete old key setelah new key aktif

# 2. Minimal permissions - hanya berikan yang dibutuhkan
# Jangan gunakan roles/owner atau roles/editor

# 3. Gunakan secret manager untuk production (alternative)
gcloud secrets create vertex-ai-key --data-file=~/portfolio-ai-key.json
```

#### 8.2 Environment Variable Security
- ✅ **DO**: Gunakan Vercel/Netlify environment variables
- ✅ **DO**: Enable "Encrypt" option di environment variables
- ❌ **DON'T**: Commit JSON key ke git
- ❌ **DON'T**: Log service account key

#### 8.3 API Key vs Service Account
| | API Key | Service Account |
|--|---------|-----------------|
| Use Case | Simple API calls | Production applications |
| Security | Lower (single key) | Higher (JSON + rotation) |
| Permissions | Limited | Granular IAM |
| Vertex AI | ❌ Not supported | ✅ Supported |

**Vertex AI memerlukan Service Account**, tidak bisa menggunakan simple API key.

---

### 9. Cost Optimization

#### 9.1 Estimasi Biaya
```
Prompt size: ~3000 tokens (context portfolio)
Response size: ~500 tokens (average)
Total per request: ~3500 tokens

Harga Gemini 2.5 Flash:
- Input: $0.15 per 1M tokens
- Output: $0.30 per 1M tokens

Cost per request: 
  (3000/1M * $0.15) + (500/1M * $0.30) = $0.00045 + $0.00015 = $0.0006

1000 requests/bulan = ~$0.60
```

#### 9.2 Tips Menghemat Biaya
1. **Cache context** - Jangan fetch Supabase setiap request
2. **Truncation** - Batasi panjang context
3. **Rate limiting** - Prevent abuse
4. **Model selection** - Flash vs Pro berdasarkan use case
5. **Set budget alerts** di Google Cloud Billing

```bash
# Set budget alert
gcloud billing budgets create \
    --billing-account=BILLING_ACCOUNT_ID \
    --display-name="Vertex AI Budget" \
    --budget-amount=10USD \
    --threshold-rule=percent=80
```

---

## 🌍 Localization (Multi-language)

### Supported Languages
- **English (EN)** - Default
- **Indonesian (ID)**

### Chat Localization Keys

```typescript
// src/contexts/LanguageContext.tsx
const translations = {
  en: {
    'chat.title': 'Dhanypedia Assistant',
    'chat.placeholder': 'Ask about my projects...',
    'chat.greeting': 'Hi! I can help you learn about the projects and skills in this portfolio...',
  },
  id: {
    'chat.title': 'Asisten Dhanypedia',
    'chat.placeholder': 'Tanya tentang proyek saya...',
    'chat.greeting': 'Hai! Saya bisa membantu Anda mengetahui tentang proyek dan keahlian...',
  }
};
```

### Language Detection
AI secara otomatis mendeteksi bahasa user dan merespons dalam bahasa yang sama:
```
LANGUAGE HANDLING:
- Detect the user's language (English or Indonesian)
- Respond in the SAME language as the question
```

---

## 🎨 Styling & Theming

### CSS Variables untuk Chat
```css
/* Dark Theme (Default) */
:root, [data-theme="dark"] {
  --chat-user-text: #ffffff;
  --chat-assistant-bg: #1e293b;
  --chat-assistant-text: #f8fafc;
  --chat-assistant-border: #334155;
  --chat-subtitle-text: #94a3b8;
  --chat-input-bg: #0f172a;
  --chat-input-border: #334155;
  --chat-input-text: #f8fafc;
  --chat-input-placeholder: #64748b;
}

/* Light Theme */
[data-theme="light"] {
  --chat-user-text: #ffffff;
  --chat-assistant-bg: #ffffff;
  --chat-assistant-text: #0f172a;
  --chat-assistant-border: #e2e8f0;
  --chat-subtitle-text: #475569;
  --chat-input-bg: #ffffff;
  --chat-input-border: #cbd5e1;
  --chat-input-text: #0f172a;
  --chat-input-placeholder: #94a3b8;
}
```

### Component Classes
| Elemen | Class |
|--------|-------|
| Chat Window | `glass-card` |
| User Message | `bg-[var(--accent-primary)] text-white` |
| Assistant Message | `bg-[var(--chat-assistant-bg)] border border-[var(--chat-assistant-border)]` |
| Input Field | `bg-[var(--chat-input-bg)] border-[var(--chat-input-border)]` |

---

## 📊 Data Flow Diagram

```
┌─────────────────┐
│  User Mengakses │
│  Portfolio Site │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     Auto-open     ┌─────────────────┐
│  ChatWidget     │ ─────────────────▶ │  Chat Window    │
│  (Component)    │    after 1s       │  Terbuka        │
└────────┬────────┘                   └────────┬────────┘
         │                                      │
         │ User mengetik pertanyaan             │
         ▼                                      │
┌─────────────────┐                            │
│  POST /api/chat │                            │
│  {message}      │                            │
└────────┬────────┘                            │
         │                                     │
         ▼                                     │
┌───────────────────────────────────────────────────────┐
│                   API Route Handler                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐│
│  │  Validate   │─▶│ Get Context │─▶│ Build Prompt    ││
│  │  Request    │  │ from DB     │  │ with Guardrails ││
│  └─────────────┘  └─────────────┘  └────────┬────────┘│
│                                             │         │
│  ┌─────────────┐  ┌─────────────┐  ┌────────▼────────┐│
│  │  Return     │◀─│   Validate  │◀─│  Vertex AI      ││
│  │  Response   │  │   Response  │  │  Gemini 2.5     ││
│  └─────────────┘  └─────────────┘  └─────────────────┘│
└───────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  AI Response    │
│  Ditampilkan    │
│  di Chat UI     │
└─────────────────┘
```

---

## 🚀 Performance & Security

### 1. **Server-Side Context Loading**
- Semua data portfolio diambil **server-side** untuk keamanan
- Tidak ada data sensitif yang terexpose di client

### 2. **Rate Limiting**
- Error handling untuk HTTP 429 (Too Many Requests)
- User-friendly message saat API sibuk

### 3. **Data Completeness Tracking**
```typescript
const dataCompleteness = (tablesLoaded / totalTables) * 100;
// Log: "Portfolio context loaded: 5/5 tables, 45ms, 100% complete"
```

### 4. **Anti-Hallucination Validation**
- Pattern matching untuk uncertainty indicators
- Metadata warning jika response mencurigakan

---

## 🔧 Cara Penggunaan

### Integrasi di Page
```tsx
// src/app/page.tsx
import ChatWidget from '@/components/ChatWidget';

export default function Home() {
  return (
    <main>
      {/* Other components */}
      <ChatWidget />
    </main>
  );
}
```

### Testing API
```bash
# Local testing
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What projects has Dhany worked on?"}'
```

---

## 📈 Future Enhancements

Beberapa ide pengembangan fitur chatbot di masa depan:

1. **Chat History** - Simpan history percakapan per session
2. **Feedback System** - Tombol 👍/👎 untuk rating response
3. **Suggested Questions** - Quick-reply buttons untuk FAQ
4. **Voice Input** - Speech-to-text untuk input
5. **File Attachment** - Upload dokumen untuk ditanyakan
6. **Analytics** - Tracking popular questions
7. **Multi-modal** - Dukungan untuk gambar (Gemini Vision)

---

## 📝 Catatan Penting

1. **Model**: Menggunakan `gemini-2.5-flash` yang cepat dan cost-effective
2. **Context Window**: Pastikan total prompt tidak melebihi limit model
3. **Cold Start**: Vertex AI mungkin memiliki cold start saat pertama kali dipanggil
4. **Data Update**: Context di-fetch fresh setiap request untuk data terbaru
5. **Security**: Service Account JSON harus disimpan dengan aman di environment variables

---

## 🔗 Referensi

- [Google Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Gemini API Reference](https://ai.google.dev/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)

---

**Dibuat oleh**: Dhany Yudi Prasetyo  
**Tanggal**: 20 Maret 2026  
**Versi**: 2.0 (Vertex AI Technical Guide Added)
