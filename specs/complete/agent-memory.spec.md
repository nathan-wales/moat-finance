Memory prompt

We need to implement a new “Memories” feature for Moat Finance, our personal finance app. Moat Finance is becoming the financial data layer for agents. The goal is to allow the user’s personal finance agent to save and retrieve durable financial memories through MCP tools, while also giving users full visibility and control in settings.
This needs to work in both the cloud web app and the local desktop private app. Shared business logic, types, validation, and MCP tool definitions should live in a shared package so both apps can consume the same memory functionality.
Context:
* The web app uses Next.js App Router, TypeScript, React, Tailwind, and Prisma.
* The desktop app is a local/private version that uses SQLite.
* The canonical data model should be defined in schema.prisma, then adapted/converted for the SQLite desktop version.
* The desktop app should store memories locally only.
* The web app should store memories in the normal cloud database.
* This feature should be privacy-first and user-controlled.
Feature requirements:
1. Create a new Memory data model.
Add a Prisma model similar to:
model Memory {
  id          String   @id @default(cuid())
  userId      String
  title       String
  content     String
  category    String?  // preference, financial_goal, account_context, budgeting_rule, tax_context, insurance_context, household_context, business_context, other
  source      String   // manual, agent, mcp
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, category])
  @@index([userId, deletedAt])
}
Adjust relation names to match the existing app’s User model and conventions.
2. Create shared memory package code.
Add or update a shared package for memory logic. It should include:
Memory
MemoryCategory
MemorySource
CreateMemoryInput
UpdateMemoryInput
MemoryService
Use Zod validation schemas for create/update inputs.
Suggested categories:
export const MEMORY_CATEGORIES = [
  "preference",
  "financial_goal",
  "account_context",
  "budgeting_rule",
  "tax_context",
  "insurance_context",
  "household_context",
  "business_context",
  "other",
] as const;
Suggested sources:
export const MEMORY_SOURCES = ["manual", "agent", "mcp"] as const;
3. Implement memory service methods.
Create a memory service abstraction that can be used by both web and desktop adapters:
createMemory(input)
updateMemory(id, input)
getMemoryById(id)
listMemories({ userId, category?, search? })
deleteMemory(id)
deleteAllMemories(userId)
Use soft delete if that matches the rest of the app’s conventions. If the app generally hard-deletes user-owned data, follow existing project convention.
The list method should only return non-deleted memories.
4. Add duplicate prevention.
Before creating a memory, check for an existing active memory for the same user with the same normalized title/content. If found, either return the existing memory or update it instead of creating a duplicate.
Keep this simple for v1. We do not need embeddings yet.
5. Add MCP tools.
Expose MCP tools for agents:
Tool 1: moat.getMemories
Purpose:Retrieve saved financial memories for the current user.
Input schema:
{
  category?: MemoryCategory;
  search?: string;
}
Output:A list of memories with id, title, content, category, source, createdAt, updatedAt.
Tool 2: moat.saveMemory
Purpose:Save a durable financial memory when the user explicitly asks to remember something or when the agent identifies financial information that would be useful in future financial planning, budgeting, investing, insurance, tax, or account-context tasks.
Input schema:
{
  title: string;
  content: string;
  category?: MemoryCategory;
}
Behavior:
* Validate input.
* Associate memory with the authenticated/current user.
* Set source to mcp.
* Run duplicate prevention.
* Return the saved memory.
MCP tool description guidance:
The save-memory tool should only be used for durable, user-relevant financial context. It should not save transient transactions, one-off purchases, temporary facts, or sensitive details that are not needed for future financial assistance. It should save memories when the user explicitly says to remember something or when the information will likely remain useful across future financial conversations.
Good examples:
* “The user wants to maintain at least $1,500 in checking before moving extra money to savings.”
* “The user prefers conservative assumptions when projecting investment growth.”
* “The user’s top financial goal is saving for a house down payment.”
* “The user wants budgeting advice to prioritize debt payoff before extra investing.”
Bad examples:
* “The user bought coffee today.”
* “The user checked their balance.”
* “The user asked about a transaction once.”
* “The user is currently browsing the app.”
6. Add Settings UI.
Add a new Settings tab/page called “Memories”.
The page should allow the user to:
* View all saved memories.
* Search/filter memories.
* Filter by category if easy.
* Create a new memory manually.
* Edit an existing memory.
* Delete an individual memory.
* Delete all memories after confirmation.
Each memory card/list item should show:
* Title
* Content
* Category
* Source: Manual / Agent / MCP
* Created date
* Updated date
* Actions: Edit, Delete
Manual creation/editing should open a dialog/modal with:
* Title input
* Category select
* Memory textarea
* Save/cancel buttons
Delete all should require a confirmation dialog with strong copy like:
“Delete all memories? This cannot be undone.”
7. Add API routes/server actions.
For the web app, add the necessary API routes or server actions following the project’s existing architecture.
Likely operations:
GET /api/memories
POST /api/memories
PATCH /api/memories/:id
DELETE /api/memories/:id
DELETE /api/memories
Use whatever routing/server-action pattern already exists in the app.
All routes must enforce authentication and ensure users can only access their own memories.
8. Add desktop implementation.
For the desktop app, implement the same memory functionality using the local SQLite database.
The desktop version should not call the cloud API for memories.
The desktop implementation should reuse the shared package types, validation, and service interface, but use the SQLite/local adapter for persistence.
9. Privacy and security requirements.
* Users must be able to see every memory saved.
* Users must be able to delete individual memories.
* Users must be able to delete all memories.
* MCP save calls should never save hidden memories that are invisible in the UI.
* All memory access must be scoped to the authenticated/current user.
* Desktop memories must remain local.
* Cloud memories must follow existing app security conventions.
* Avoid storing unnecessary sensitive data.
* Use existing auth/session utilities.
* Use existing toast, modal, button, input, textarea, and settings layout components where available.
10. Suggested folder structure.
Adapt to the actual repo, but aim for something like:
packages/
  shared/
    src/
      memories/
        types.ts
        schemas.ts
        service.ts
        mcp.ts
        index.ts

apps/
  web/
    app/
      settings/
        memories/
          page.tsx
    components/
      settings/
        memories/
          MemoryList.tsx
          MemoryCard.tsx
          MemoryDialog.tsx
          DeleteAllMemoriesDialog.tsx
    app/
      api/
        memories/
          route.ts
        memories/[id]/
          route.ts

apps/
  desktop/
    src/
      db/
        sqlite-memory-adapter.ts
      features/
        memories/
11. Acceptance criteria.
* A user can manually create a memory in Settings → Memories.
* A user can view all memories they have created or that were saved by MCP.
* A user can edit a memory.
* A user can delete one memory.
* A user can delete all memories.
* The MCP server exposes moat.getMemories.
* The MCP server exposes moat.saveMemory.
* MCP-created memories show up in the settings UI.
* Web app persists memories in the cloud database.
* Desktop app persists memories in local SQLite.
* Shared types and validation are reused across web and desktop.
* User scoping is enforced everywhere.
* Duplicate exact/normalized memories are not repeatedly created.
* The implementation matches existing project conventions for styling, data fetching, auth, errors, and toasts.
Please inspect the existing repo structure before implementing and follow existing naming conventions. Avoid introducing unnecessary new dependencies unless clearly justified.

Also have a Settings on the memory settings page for the desktop and the Web app where there is a toggle that is defaulted to on for enable memory, reading and writing, which is turned off Wood disable the agent from reading, reading past memories and creating past memories
