# Pattern: Main Process, Renderer, and IPC (apps/desktop)

## Electron process model

The desktop app has three isolated contexts with strict boundaries:

| Context | Location | Access |
|---------|----------|--------|
| Main process | `src/main/` | Full Node.js, filesystem, SQLite, Electron APIs |
| Preload script | `src/preload/index.ts` | Node.js + Electron bridge (contextBridge only) |
| Renderer process | `src/renderer/` | Browser APIs only — NO direct Node.js access |

The renderer is a sandboxed browser context. It can only communicate with the main process through the `contextBridge` channels exposed by the preload script.

---

## Security rules (non-negotiable)

- **`contextIsolation: true` and `nodeIntegration: false` are always set** in `BrowserWindow` options. Never change these.
- **Never expose raw Node.js modules, Prisma, or AppContext through `contextBridge`.** Expose only typed, scoped IPC channel functions.
- **`sandbox: false`** is set because preload scripts need `path` and similar Node.js globals — this is intentional and safe as long as `contextIsolation` remains `true`.

---

## IPC channel conventions

Channels are organized by domain. Each domain has:
1. A channel constants file in `packages/contracts/src/` (type-safe names + types)
2. A main-process handler file in `src/main/ipc/[domain].ts`
3. Preload bridge bindings in `src/preload/index.ts`

### Main-process handler pattern

```ts
// src/main/ipc/transactions.ts
import { ipcMain } from "electron";
import { getDesktopDb } from "../db";
import { TRANSACTION_CHANNELS } from "@moat/contracts";

export function registerTransactionHandlers(): void {
  ipcMain.handle(TRANSACTION_CHANNELS.LIST, async (_event, input) => {
    const { appCtx } = getDesktopDb();
    return appCtx.transactions.list(input);
  });

  ipcMain.handle(TRANSACTION_CHANNELS.UPDATE, async (_event, input) => {
    const { appCtx } = getDesktopDb();
    return appCtx.transactions.update(input);
  });
}
```

### Registering all handlers

All domain handler registrations flow through `src/main/ipc/register-handlers.ts`. Call `registerAllHandlers()` once in `src/main/index.ts` before creating the window:

```ts
// src/main/index.ts
registerAllHandlers(); // must be called before createWindow()
await createWindow();
```

When adding a new domain, add a `register[Domain]Handlers()` call to `register-handlers.ts`.

### Preload bridge pattern

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer } from "electron";
import { TRANSACTION_CHANNELS } from "@moat/contracts";

contextBridge.exposeInMainWorld("moat", {
  // ... other domains
  transactions: {
    list: (input) => ipcRenderer.invoke(TRANSACTION_CHANNELS.LIST, input),
    update: (input) => ipcRenderer.invoke(TRANSACTION_CHANNELS.UPDATE, input),
  },
});
```

### Renderer usage

```ts
// src/renderer/src/lib/ipc/transactions.ts — typed wrapper around window.moatDesktop
export const transactionsIpc = {
  list: (input: ListTransactionsInput) => window.moatDesktop.transactions.list(input),
  update: (input: UpdateTransactionInput) => window.moatDesktop.transactions.update(input),
};
```

---

## Adding a new IPC domain (checklist)

1. Add channel constants + input/output types to `packages/contracts/src/`
2. Create `src/main/ipc/[domain].ts` with `registerXxxHandlers()`
3. Add the register call to `register-handlers.ts`
4. Expose the channel in `src/preload/index.ts` via `contextBridge`
5. Add a typed IPC wrapper in `src/renderer/src/lib/ipc/[domain].ts`

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a new IPC channel | This file (checklist) |
| Working with local SQLite data | [sqlite-and-local-data.md](sqlite-and-local-data.md) |
| Working with the local agent gateway | [local-agent-gateway.md](local-agent-gateway.md) |
| Packaging / distribution | [packaging.md](packaging.md) |
