# @moat/client-ts

Typed TypeScript client for the Moat Finance REST API, auto-generated from the OpenAPI spec.

## Installation

The client is included in the monorepo workspace and is available to all apps:

```bash
npm install
```

## Usage

### Basic Setup

The client exports all API functions and types:

```typescript
import {
  listCategories,
  getAllTransactions,
  type Category,
  type Transaction,
} from '@moat/client-ts';
```

### Configuration

The client determines the API base URL from the environment:

1. **Browser**: Uses `window.location.origin` (same origin)
2. **Server/Node**: Uses `NEXT_PUBLIC_API_URL` or `API_URL` environment variables

**In `apps/web`:**
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Examples

#### Check demo mode status

```typescript
const { data, status } = await getDemoStatus();
if (status === 200) {
  console.log('Demo mode active:', data.data.isDemoMode);
}
```

#### List categories

```typescript
const { data } = await listCategories();
const categories: Category[] = data.data;
```

#### Get transactions with pagination

```typescript
const { data } = await getAllTransactions({
  limit: 50,
  cursor: 0,
  sortField: 'date',
  sortDir: 'desc',
  type: 'EXPENSE',
});

const { items, nextCursor } = data.data;
```

#### Create and update category

```typescript
const createRes = await createCategory({ name: 'Food' });
const newCat: Category = createRes.data.data;

const updateRes = await updateCategory({
  id: newCat.id,
  name: 'Food & Groceries',
});
```

#### Set hashtags on transaction

```typescript
await setHashtagsOnTransaction({
  transactionId: 'tx-123',
  hashtags: ['#groceries', '#food'],
});
```

## Generation

The client is generated from the OpenAPI spec via `orval`:

```bash
cd packages/openapi
npm run generate
```

This writes the generated client to `packages/client-ts/src/index.ts`.

**Do not edit `src/index.ts` manually** — regenerate after modifying the OpenAPI spec.

## API Response Format

All functions return a consistent response format:

```typescript
type ApiResponse<T> = {
  data: {
    data: T; // The actual response data
    status: number; // HTTP status code
  };
};
```

## Adding New Endpoints

1. Add the endpoint to `packages/openapi/api-v1.yaml`
2. Run `npm run generate` in `packages/openapi`
3. The new types and functions will be added to `packages/client-ts/src/index.ts`
4. Import and use in your code

## Session/Auth

The client includes credentials in all requests:

```typescript
credentials: 'include' // Cookies are sent with requests
```

This allows session-based auth (NextAuth) to work seamlessly.

## Error Handling

If a request fails, the Promise will be rejected:

```typescript
try {
  const res = await listCategories();
  if (res.status !== 200) {
    console.error('Failed:', res.status);
  }
} catch (error) {
  console.error('Request failed:', error.message);
}
```

## See Also

- [OpenAPI Spec](../openapi/api-v1.yaml)
- [API Server](../../apps/api)
- [Example Usage](./EXAMPLE.ts)
