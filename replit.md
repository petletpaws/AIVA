# Operto Task Management Dashboard

## Overview

This is a task management dashboard application designed to interface with the Operto Teams API. The application allows users to view, filter, and manage operational tasks from Operto's property management system. Built with a focus on data-heavy operations, it provides a professional interface for operational teams to track task completion, assignments, and property-related activities.

The application follows a modern full-stack architecture with React on the frontend and Express.js on the backend, utilizing Material Design principles for a clean, utility-focused user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tool**
- React 18 with TypeScript for type safety and modern component development
- Vite as the build tool for fast development and optimized production builds
- Single-page application (SPA) architecture with component-based design

**UI Component System**
- Shadcn UI component library (New York style variant) built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Material Design principles for data-heavy interfaces
- Dark mode support with theme persistence in localStorage
- Responsive design with mobile-first breakpoints

**State Management**
- TanStack Query (React Query) for server state management and API caching
- Local component state using React hooks for UI state
- Toast notifications for user feedback

**Design System**
- Custom color palette supporting light and dark modes
- Inter font family from Google Fonts for optimal readability
- Consistent spacing system using Tailwind's scale (8px, 16px, 24px, 32px)
- Elevation system for interactive elements using opacity-based overlays

### Backend Architecture

**Server Framework**
- Express.js running in ESM module mode
- RESTful API design pattern
- Custom middleware for request/response logging

**API Structure**
- `/api/settings` - GET/POST endpoints for managing Operto API credentials
- `/api/auth/login` - Authentication with Operto API
- `/api/tasks` - Proxy endpoints for fetching tasks from Operto API
- Error handling middleware with standardized error responses

**Authentication Flow**
- Operto API uses OAuth-style token authentication
- Access tokens stored in-memory and cleared when settings change
- Token refresh handled automatically on API calls

**Data Validation**
- Zod schemas for runtime type validation
- Shared schema definitions between client and server
- Type-safe API contracts using TypeScript and Zod inference

### Data Storage

**Current Implementation**
- In-memory storage using `MemStorage` class
- Stores API credentials and access tokens
- Data persists only during server runtime

**Database Schema Design**
- Drizzle ORM configured for PostgreSQL
- Migration system ready via `drizzle-kit`
- Schema defined in `shared/schema.ts` for type sharing
- Note: Database integration is configured but storage currently uses memory-only implementation

**Data Models**
- `OpertoSettings`: API credentials and query parameters
- `OpertoTask`: Task entities with nested property and staff data
- `OpertoStaff`: Staff assignment information
- `OpertoProperty`: Property details for task association

### External Dependencies

**Operto Teams API**
- Base URL: `https://teams-api.operto.com/api/v1`
- Authentication: API Key/Value pair authentication
- Endpoints consumed:
  - Authentication endpoint for access token retrieval
  - Tasks endpoint with pagination support (`has_more`, `next_page`)
- Query parameters: completion status, date ranges, pagination

**Third-Party Libraries**
- Axios for HTTP requests to Operto API
- React Hook Form with Zod resolvers for form validation
- date-fns for date manipulation and formatting
- Radix UI primitives for accessible component foundation
- class-variance-authority (CVA) for component variant management

**Development Tools**
- Replit-specific plugins for development environment integration
- ESBuild for production server bundling
- TypeScript compiler for type checking (no-emit mode)
- PostCSS with Autoprefixer for CSS processing

**Styling Dependencies**
- Tailwind CSS v3 with JIT mode
- Custom CSS variables for theme tokens
- clsx and tailwind-merge for conditional class management

### Key Architectural Decisions

**Monorepo Structure**
- Client code in `/client` directory
- Server code in `/server` directory  
- Shared types and schemas in `/shared` directory
- Centralized TypeScript configuration with path aliases

**Type Safety Strategy**
- Shared Zod schemas between frontend and backend
- TypeScript strict mode enabled
- Runtime validation on API boundaries
- Type inference from Zod schemas to reduce duplication

**API Proxy Pattern**
- Backend acts as proxy to Operto API
- Credentials never exposed to frontend
- Centralized error handling and logging
- Token management abstracted from client

**Component Organization**
- UI components in `/client/src/components/ui` (shadcn components)
- Feature components in `/client/src/components` (Header, TaskTable, etc.)
- Example components for development reference

**Build and Deployment**
- Separate dev and production npm scripts
- Vite dev server with HMR in development
- Static asset serving in production
- Server-side rendering disabled (SPA mode)

## Invoice and Email Feature

**Invoice Generation**
- Invoices are automatically grouped by staff member from task data
- Each invoice shows all tasks assigned to a staff member with amounts
- Invoice preview available before sending
- Total amount calculated per staff member

**Email Integration**
- Uses Resend API for sending invoice emails
- Requires Resend integration to be configured via Replit
- HTML-formatted invoices with task details and totals
- API endpoint: `POST /api/invoices/send`

## AI-Powered Invoice Verification (Files Feature)

**File Upload**
- Drag-and-drop or browse to upload contractor invoices
- Supported formats: PDF, Word (.doc, .docx), Images (.png, .jpg, .gif), Text (.txt)
- Files stored in `/uploads` directory on server

**AI Extraction**
- Uses OpenAI GPT-5 model for intelligent invoice data extraction
- Extracts: staff name, total amount, date, property name, line items
- Fallback to basic regex extraction if OpenAI unavailable
- Requires `OPENAI_API_KEY` environment variable

**Invoice Matching**
- Compares uploaded invoice data against system-generated invoices
- Matches by staff name (exact, partial, or name parts)
- Matches by amount when staff name cannot be determined
- Three-tier visual indicators:
  - Green (Verified): Full match on staff name and amount
  - Orange (Needs Review): Partial match requiring verification
  - Red (No Match): No matching invoice found in system

**API Endpoints**
- `POST /api/files/upload` - Upload file for processing
- `POST /api/files/:fileId/process` - Extract and match invoice data
- `GET /api/files` - List all uploaded files
- `DELETE /api/files/:fileId` - Remove uploaded file

**Extracted Text Verification**
- View the full raw text extracted from uploaded files
- Helps verify if extraction quality meets expectations
- Copy extracted text to clipboard
- Download extracted text as .txt file
- Reprocess files to re-run AI extraction
- Shows AI-extracted data summary (staff name, amount, date, property)

## Staff Task Grouping

**Task Table Grouping**
- Tasks are grouped by individual staff members
- Tasks with multiple staff assigned appear in each staff member's group separately
- Enables accurate per-person task tracking and invoicing