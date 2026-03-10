You are a senior full-stack product engineer and solution architect.

Your task is to DESIGN and BUILD an MVP web application module called **DocStudio**.

DocStudio will be integrated as **Tab 9** inside an existing multi-tool internal web application that already has 8 tabs/tools.

You must follow this brief exactly.

==================================================
0. WORKING MODE
==================================================

Operate in builder mode, not consultant mode.

Do not give generic advice.
Do not reduce the product into a toy demo.
Do not redesign the whole parent system unless necessary.

You must build DocStudio as a **modular app inside an existing tool suite**, with clean boundaries, so it can live inside Tab 9 while remaining architecturally independent.

You must produce:
1. technical implementation plan,
2. integration plan for existing shell app,
3. Firestore data model,
4. frontend and backend architecture,
5. core UI screens,
6. document creation and formatting flow,
7. template-driven rendering flow,
8. validation engine,
9. export flow for DOCX/PDF,
10. Firebase Auth-based RBAC,
11. Cloudflare deployment-friendly implementation.

When details are missing, make the most practical engineering decision and proceed.

Do not ask unnecessary clarification questions.
Only stop if there is a truly blocking technical ambiguity.

==================================================
1. PRODUCT OVERVIEW
==================================================

Build **DocStudio**, an AI-assisted, template-driven document layout and formatting module.

DocStudio is NOT a generic text editor.
It is a document formatting and layout system that converts raw content into professionally formatted documents based on:
- document type,
- templates,
- layout rules,
- style packs,
- validation rules,
- export settings.

DocStudio must be integrated into an existing app as **Tab 9**.

This means:
- it uses the existing parent navigation shell,
- it can share global layout/navigation/auth session if appropriate,
- but its business logic, data model, validation, rendering, exports, and templates must remain modular and isolated.

Core user flow:
- user opens Tab 9 (DocStudio)
- user creates/selects a document
- chooses document type
- chooses template
- chooses style pack
- inputs content
- system normalizes content
- system generates formatted preview
- system validates document
- system exports DOCX/PDF
- system stores versions and artifacts

==================================================
2. PLATFORM AND PRODUCT CONSTRAINTS
==================================================

You must prioritize this ecosystem:

A. Google products
- Firebase Authentication
- Cloud Firestore
- Cloud Storage for Firebase

B. Git-based source control
- all code must be suitable for storage in a Git repository
- keep file structure clean and modular
- avoid generated chaos

C. Cloudflare deployment
- application must be deployable to Cloudflare
- implementation should be compatible with Cloudflare Pages / Workers style deployment
- avoid infrastructure choices that tightly lock the app to another runtime

Do NOT use PostgreSQL, Prisma, or NextAuth in this version.
Do NOT use AWS-oriented architecture unless absolutely unavoidable.
Use Firebase for auth, database, and storage.

==================================================
3. PRODUCT GOALS
==================================================

The MVP must allow users to:

- access DocStudio inside Tab 9 of the existing suite
- create a new document
- choose a document type
- choose a template
- choose a style pack
- input content using Markdown or a simple rich text editor
- normalize content into an internal block schema
- generate document preview
- validate formatting and structural issues
- export DOCX
- export PDF
- save versions
- manage templates
- enforce role-based permissions

The product must reduce:
- manual formatting work
- formatting inconsistency
- missing required sections
- misuse of document templates

==================================================
4. INTEGRATION REQUIREMENTS: TAB 9 INSIDE EXISTING APP
==================================================

This is mandatory.

DocStudio is a module inside an existing 8-tool suite.

Implement it so that:

1. It can live under a route namespace like:
- /tools/docstudio
or
- /app/docstudio

2. It can be mounted as a dedicated Tab 9 in the parent navigation.

3. It must not break existing tabs.

4. It may reuse:
- parent shell layout
- parent sidebar/topbar
- parent auth session if already available

5. But it must keep these isolated:
- document data
- templates
- style packs
- validation engine
- exports
- document versions
- DocStudio screens/components/services

6. If the parent suite already has a role or user model, create an adapter layer rather than tightly coupling DocStudio internals to legacy assumptions.

7. DocStudio must be removable or deployable as a standalone module later with minimal refactor.

==================================================
5. TARGET USERS
==================================================

Support 3 roles for DocStudio:

1. ADMIN
- manage all documents
- manage templates
- manage style packs
- manage settings
- view all versions
- view all exports

2. EDITOR
- create and edit own documents
- generate preview
- validate
- export
- upload assets

3. REVIEWER
- view documents
- view previews
- view validation
- download exports
- cannot edit source content

==================================================
6. MVP SCOPE
==================================================

The MVP must support these document types:

A. Administrative / Legal
- Official Letter
- Meeting Minutes
- Contract / Agreement

B. Books
- Book A5
- Book 14.5 x 20.5 cm

C. Business / Media
- 2-column Newsletter
- A4 Business Report

MVP output types:
- DOCX
- PDF

MVP authoring modes:
- Markdown editor
- Simple rich text editor

MVP template features:
- choose template
- preview template
- duplicate template
- Admin can edit template config

MVP validation:
- structural validation
- layout validation
- template compatibility validation

==================================================
7. OUT OF SCOPE FOR MVP
==================================================

Do NOT build these now:
- real-time collaborative editing
- comments like Google Docs
- Google Docs sync
- Adobe InDesign integration
- IDML export
- OCR
- advanced AI content generation
- advanced workflow approvals
- native mobile app
- billing/subscriptions
- full enterprise multitenancy

Design for future extensibility, but do not implement now.

==================================================
8. TECH STACK REQUIREMENT
==================================================

Use a modern stack compatible with Git-based development and Cloudflare deployment.

Preferred stack:

Frontend:
- Next.js
- React
- TypeScript
- Tailwind CSS
- clean component architecture
- form handling with a robust schema-based approach
- lightweight state management only where necessary

Auth:
- Firebase Authentication

Database:
- Cloud Firestore

Storage:
- Cloud Storage for Firebase
- use for uploaded assets and exported files

Deployment target:
- Cloudflare Pages and/or Cloudflare Workers compatible setup

Document processing:
- server-side or edge-compatible service architecture
- make practical decisions for DOCX/PDF generation compatible with Cloudflare deployment patterns
- if a specific export task cannot run comfortably at the edge, isolate it as a clearly separated service boundary and document why

Important:
Avoid tightly coupling the app to Node-only assumptions unless absolutely necessary.
Cloudflare compatibility matters.

==================================================
9. CORE PRODUCT PRINCIPLES
==================================================

The architecture must follow these principles:

1. Content is separate from formatting
2. Template rules are separate from style packs
3. Validation rules are separate from rendering logic
4. Normalized internal document schema is the source of truth
5. UI preview should reflect export structure closely
6. Server-side or trusted-runtime permission checks are mandatory
7. DocStudio must work as a module inside a larger suite
8. Future extraction into standalone app should be possible

==================================================
10. INFORMATION ARCHITECTURE
==================================================

DocStudio module areas:

1. DocStudio Dashboard
2. Document list
3. Create document flow
4. Document editor
5. Preview + validation
6. Export history
7. Template library
8. Template editor
9. Style pack manager
10. Version history
11. DocStudio settings

==================================================
11. REQUIRED USER FLOWS
==================================================

Flow 1: Open Tab 9
- User clicks Tab 9 from existing parent menu
- DocStudio dashboard opens inside existing shell

Flow 2: Create a new document
- User clicks Create New Document
- Selects document type
- Selects template
- Selects style pack
- Enters title
- Opens editor
- Inputs content
- Clicks Generate Preview
- System normalizes content
- System validates content
- System renders preview
- User sees validation issues
- User fixes issues if needed
- User exports DOCX or PDF
- System saves version

Flow 3: Import raw content
- User pastes raw Markdown or text
- System parses into internal blocks
- User reviews structure
- User generates preview
- User validates
- User exports

Flow 4: Duplicate template
- Admin opens template library
- Selects existing template
- Duplicates it
- Edits config
- Saves template
- Makes it available to users

Flow 5: Review a version
- Reviewer opens document
- Views preview
- Views validation summary
- Downloads exports
- Cannot edit raw content

==================================================
12. DATA MODEL REQUIREMENTS (FIRESTORE)
==================================================

Design the app using Firestore collections and documents.

Required logical entities:

1. users
- id
- name
- email
- role (ADMIN, EDITOR, REVIEWER)
- status
- createdAt
- updatedAt

2. documents
- id
- title
- slug
- documentType
- ownerId
- templateId
- stylePackId
- status (DRAFT, GENERATED, VALIDATED, EXPORTED, ARCHIVED)
- currentVersionId
- createdAt
- updatedAt

3. documentVersions
- id
- documentId
- versionNumber
- contentSourceType (MARKDOWN, RICHTEXT, IMPORTED_TEXT)
- rawContent
- normalizedContentJson
- validationStatus (PASS, WARNING, ERROR)
- previewSnapshotPath
- exportDocxPath
- exportPdfPath
- createdById
- createdAt

4. templates
- id
- name
- slug
- description
- documentType
- pageSize
- orientation
- marginsJson
- gutter
- columns
- headerConfigJson
- footerConfigJson
- headingRulesJson
- paragraphRulesJson
- tableRulesJson
- signatureRulesJson
- numberingRulesJson
- requiredBlocksJson
- isSystem
- isActive
- createdById
- createdAt
- updatedAt

5. stylePacks
- id
- name
- slug
- category
- fontHeading
- fontBody
- fontCaption
- fontMono
- baseFontSize
- lineHeight
- headingScaleJson
- colorPaletteJson
- tableStyleJson
- quoteStyleJson
- captionStyleJson
- isActive
- createdAt
- updatedAt

6. validationIssues
- id
- documentVersionId
- severity (ERROR, WARNING, INFO)
- code
- message
- blockId
- pageNumber
- suggestion
- createdAt

7. assets
- id
- documentId
- uploadedById
- type (IMAGE, LOGO, ATTACHMENT)
- fileName
- storagePath
- mimeType
- size
- metadataJson
- createdAt

8. exportArtifacts
- id
- documentVersionId
- type (DOCX, PDF)
- storagePath
- fileSize
- createdById
- createdAt

Use Firestore-friendly modeling.
Use subcollections where appropriate if it improves scaling and query clarity.
Add indexes and query strategy notes.

==================================================
13. INTERNAL NORMALIZED DOCUMENT SCHEMA
==================================================

This is critical.

Do NOT use raw editor HTML as the rendering source of truth.

All content must be transformed into a normalized JSON schema.

Support at minimum these block types:
- heading
- paragraph
- list
- quote
- image
- table
- signature
- appendix
- recipient_list
- page_break

Support sections.

Conceptual shape:

{
  "sections": [
    {
      "id": "sec_1",
      "type": "body",
      "title": "Section title",
      "blocks": [
        {
          "id": "blk_1",
          "type": "heading",
          "level": 1,
          "text": "Title"
        },
        {
          "id": "blk_2",
          "type": "paragraph",
          "text": "Paragraph content"
        }
      ]
    }
  ]
}

Build parsers:
- Markdown -> normalized schema
- Rich text -> normalized schema

The normalized schema must feed:
- validation engine
- preview renderer
- export engine

==================================================
14. TEMPLATE ENGINE REQUIREMENTS
==================================================

Templates must be config-driven.

A template defines:
- compatible document type
- page size
- orientation
- margins
- gutter
- columns
- header behavior
- footer behavior
- numbering rules
- spacing rules
- signature placement
- required blocks
- section defaults

Example templates:
- Official Letter
- Meeting Minutes
- Contract
- Book A5
- Book 14.5 x 20.5
- Newsletter 2-column
- Business Report A4

Admin must be able to:
- duplicate template
- edit configuration
- activate/deactivate

Editors can:
- select templates
- preview template metadata

==================================================
15. STYLE PACK REQUIREMENTS
==================================================

Style packs must be separate from templates.

Style packs define:
- font families
- base sizes
- heading scale
- spacing rhythm
- line spacing
- colors
- quote/table/caption styles

Include these defaults:
1. Legal Formal
2. Book Classic
3. Newsletter Corporate
4. Report Modern

Template = structure.
Style pack = appearance.

==================================================
16. VALIDATION ENGINE REQUIREMENTS
==================================================

Build validation as a dedicated service/module.

Validation must check:

A. Structural errors
- missing document title
- missing required signature block
- missing recipient list where required
- missing body content
- invalid heading hierarchy
- empty required sections

B. Layout warnings
- oversized image block
- possible table overflow
- unusual spacing
- unsafe printable area overflow risk
- missing chapter page break in book template
- invalid block type for template

C. Template compatibility
- wrong template for document type
- unsupported block usage

Each issue returns:
- severity
- code
- message
- blockId
- optional pageNumber
- suggestion

Summary states:
- PASS
- WARNING
- ERROR

Validation rules must be extensible.

==================================================
17. PREVIEW RENDERER REQUIREMENTS
==================================================

Build a page-like preview inside the app.

Preview must show:
- page size
- margins
- columns
- header/footer
- page numbers
- signature zones
- tables
- images
- section/chapter starts

Features:
- zoom
- page navigation
- outline navigation
- issue-to-block highlighting

Preview should match final export structure as closely as practical.

==================================================
18. EXPORT REQUIREMENTS
==================================================

Support export:
- DOCX
- PDF

Requirements:
- preserve heading hierarchy
- preserve sections
- preserve main template layout intent
- preserve page size/margins/page numbering as practically as possible

Store exports in Cloud Storage for Firebase.

Naming:
document-title_version_YYYYMMDD.ext

If DOCX/PDF generation needs special runtime handling for Cloudflare compatibility, isolate that logic behind a dedicated export service boundary and document the exact reason.

==================================================
19. AUTH & PERMISSIONS
==================================================

Use Firebase Authentication.

Implement DocStudio role-based access control.

Admin:
- full access

Editor:
- create/edit own docs
- generate
- validate
- export
- upload assets

Reviewer:
- read-only
- view validation
- download exports

Enforce permissions in trusted application logic and data access layer.
Do not rely only on client-side checks.

Also design Firestore access patterns and security-rule-friendly structure.

==================================================
20. REQUIRED UI SCREENS
==================================================

Build these screens inside DocStudio module:

1. DocStudio Dashboard
- recent documents
- create button
- filters
- quick links

2. Document list
- searchable
- filterable
- title
- type
- owner
- status
- updatedAt

3. Create document - step 1
- choose document type
- card UI

4. Create document - step 2
- choose template
- choose style pack
- show metadata

5. Editor screen
- top actions: Save / Generate Preview / Validate / Export
- title input
- left panel: editor + outline
- right panel: preview
- asset upload
- autosave status

6. Validation panel
- issue list
- severity badges
- click to jump/highlight block

7. Export panel/modal
- choose DOCX or PDF
- file name preview
- download generated exports

8. Version history
- versions timeline
- validation status
- export links

9. Template library
- list templates
- filter
- duplicate
- open config

10. Template editor
- config editing UI
- activate/deactivate

11. Style pack page
- list packs
- inspect pack data

UI must feel like a serious productivity tool inside a larger internal platform.

==================================================
21. UX REQUIREMENTS
==================================================

The app should feel structured, clear, and professional.

Priorities:
- clarity
- speed
- low confusion
- explicit workflow
- clear separation between content / template / style / validation / export

Important actions must always be easy to find:
- Save
- Generate Preview
- Validate
- Export

==================================================
22. FIRESTORE + STORAGE DESIGN REQUIREMENTS
==================================================

You must explicitly design:
- collection structure
- document IDs
- index strategy
- ownership model
- access strategy
- versioning strategy
- file storage paths

Example storage path strategy:
- /docstudio/documents/{documentId}/assets/...
- /docstudio/documents/{documentId}/versions/{versionId}/exports/...

Provide practical Firestore query guidance:
- recent documents by owner
- documents by type/status
- versions by document
- template lookup by documentType
- validation issues by version

==================================================
23. FOLDER / MODULE ARCHITECTURE
==================================================

Use a maintainable structure.

Suggested structure:

/app
  /tools
    /docstudio
      /page.tsx
      /documents
      /templates
      /style-packs
      /settings

/components
  /docstudio
    /editor
    /preview
    /validation
    /templates
    /exports

/lib
  /firebase
  /docstudio
    /auth
    /rbac
    /parsers
    /documents
    /templates
    /stylepacks
    /validation
    /render
    /export
    /storage
    /utils

/types
  /docstudio

/config
  /docstudio

Keep DocStudio modular.
Do not scatter DocStudio logic across unrelated parent-tool files.

==================================================
24. IMPLEMENTATION PHASES
==================================================

Build in this order:

Phase 1: Module foundation
- integrate Tab 9 route
- shell integration
- Firebase setup
- auth adapter
- Firestore collections
- RBAC
- dashboard
- document list

Phase 2: Document creation
- document type selection
- template selection
- style pack selection
- title + content input
- Markdown parser
- normalized schema generation

Phase 3: Preview + validation
- render engine
- preview UI
- validation engine
- issue panel

Phase 4: Export + versioning
- PDF export
- DOCX export
- Cloud Storage persistence
- version history

Phase 5: Template management
- template library
- duplicate template
- edit config
- activate/deactivate

==================================================
25. ACCEPTANCE CRITERIA
==================================================

A. Integration
- DocStudio appears as Tab 9 in existing suite
- opening Tab 9 does not break existing tabs
- DocStudio uses isolated module boundaries

B. Auth
- users can log in
- role-based access works
- protected DocStudio routes are secured

C. Create document
- user creates draft with document type/template/style
- document saves to Firestore
- editor opens correctly

D. Content normalization
- Markdown parses into normalized schema
- rich text normalizes into same schema
- parse failures return clear errors

E. Preview
- preview renders page-like view
- newsletter shows multi-column layout
- books show section/chapter structure

F. Validation
- validation runs on generate
- missing required blocks produce errors
- warnings display properly
- clicking issue highlights related block if possible

G. Export
- DOCX export works
- PDF export works
- exports saved to Cloud Storage
- export metadata saved in Firestore

H. Versioning
- generate/export creates versions
- version history visible
- previous exports downloadable

I. Templates
- Admin can duplicate and edit templates
- templates can be reused in create flow

J. Permissions
- Editor cannot manage system templates unless allowed
- Reviewer cannot edit source content
- Admin can access all

==================================================
26. ENGINEERING CONSTRAINTS
==================================================

Do NOT:
- hard-code layout rules in UI components
- use editor HTML as source of truth
- tightly couple DocStudio to the parent tool logic
- build Firestore schema carelessly without query strategy
- skip modular RBAC
- assume unlimited server runtime behavior incompatible with Cloudflare deployment

Do:
- write modular TypeScript code
- document integration points with parent shell
- use normalized schema
- keep services separated
- write clear setup instructions
- prepare code for Git-based workflow

==================================================
27. SEED / DEMO DATA REQUIREMENTS
==================================================

Create demo bootstrap data:

Users:
- 1 Admin
- 1 Editor
- 1 Reviewer

Templates:
- Official Letter
- Meeting Minutes
- Contract
- Book A5
- Book 14.5x20.5
- Newsletter 2-column
- Business Report A4

Style packs:
- Legal Formal
- Book Classic
- Newsletter Corporate
- Report Modern

Also create sample documents for testing.

==================================================
28. REQUIRED DELIVERABLES
==================================================

You must produce:

1. Working codebase
2. Firebase config structure
3. Firestore collection design
4. Storage path design
5. Auth + RBAC implementation
6. Document normalization layer
7. Template engine
8. Validation engine
9. Preview renderer
10. DOCX/PDF export pipeline
11. README with:
   - setup instructions
   - Firebase setup
   - Cloudflare deployment notes
   - folder structure
   - architecture summary
   - key tradeoffs
   - known limitations
   - next-phase roadmap

==================================================
29. OUTPUT FORMAT FOR YOUR RESPONSE
==================================================

Respond in this exact structure:

1. Executive Summary
2. Integration Strategy for Tab 9
3. Tech Stack
4. Firebase / Firestore Architecture
5. Data Model
6. Folder Structure
7. Main User Flows
8. Screen-by-Screen Build Plan
9. Core Services Design
10. Validation Rules Design
11. Rendering and Export Strategy
12. Firestore Collections and Access Model
13. API / Server Action / Service Plan
14. Implementation Phases
15. Risks and Tradeoffs
16. Final Build Checklist

After that, begin generating the actual implementation.

Do not stay only at theory level.

==================================================
30. FINAL INSTRUCTION
==================================================

Build DocStudio as a serious modular MVP inside an existing internal tool suite.

Prioritize:
- clean integration as Tab 9
- strong architecture
- Firebase-first backend
- Cloudflare-compatible deployment
- robust normalized schema
- template system
- validation engine
- usable preview
- reliable export flow

Start now.