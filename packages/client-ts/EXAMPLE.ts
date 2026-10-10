/**
 * Example: Using the generated API client in the web app
 *
 * This shows how to replace tRPC calls with REST API client calls.
 *
 * Before (tRPC):
 *   const { data } = await api.demo.getDemoStatus.useQuery();
 *
 * After (REST API):
 *   const { data } = await getDemoStatus();
 */

import {
	// Types
	type Category,
	countTransactions,
	createCategory,
	deleteCategory,
	dismissDemoNotice,
	// Demo endpoints
	enterDemoMode,
	exitDemoMode,
	// Transaction endpoints
	getAllTransactions,
	getDemoStatus,
	type Hashtag,
	hasTransactionData,
	// Category endpoints
	listCategories,
	// Hashtag endpoints
	listHashtags,
	listTransactionCategories,
	resetDemoOverlay,
	setHashtagsOnTransaction,
	type Transaction,
	updateCategory,
} from "@moat/client-ts";

// Example 1: Demo mode
async function exampleDemoMode() {
	try {
		// Enter demo mode
		const enterRes = await enterDemoMode({ sessionKey: "" });
		if (enterRes.status !== 200) {
			throw new Error("Failed to enter demo mode");
		}
		const { sessionKey, expiresAt } = enterRes.data.data;
		console.log("Entered demo mode:", { sessionKey, expiresAt });

		// Get demo status
		const statusRes = await getDemoStatus();
		if (statusRes.status !== 200) {
			throw new Error("Failed to get demo status");
		}
		console.log("Demo status:", statusRes.data.data);

		// Exit demo mode
		const exitRes = await exitDemoMode({ sessionKey });
		console.log("Exited demo mode:", exitRes.data.data);
	} catch (error) {
		console.error("Demo mode error:", error);
	}
}

// Example 2: Category management
async function exampleCategories() {
	try {
		// List categories
		const listRes = await listCategories();
		if (listRes.status !== 200) {
			throw new Error("Failed to list categories");
		}
		const categories: Category[] = listRes.data.data;
		console.log("Available categories:", categories);

		// Create a new category
		const createRes = await createCategory({ name: "Groceries" });
		if (createRes.status !== 200) {
			throw new Error("Failed to create category");
		}
		const newCategory: Category = createRes.data.data;
		console.log("Created category:", newCategory);

		// Update the category
		const updateRes = await updateCategory({
			id: newCategory.id,
			name: "Food & Groceries",
		});
		const updatedCategory: Category = updateRes.data.data;
		console.log("Updated category:", updatedCategory);

		// Delete the category
		const deleteRes = await deleteCategory({ id: newCategory.id });
		console.log("Delete result:", deleteRes.data.data);
	} catch (error) {
		console.error("Category error:", error);
	}
}

// Example 3: Transaction queries
async function exampleTransactions() {
	try {
		// Check if user has transaction data
		const hasDataRes = await hasTransactionData();
		const hasData: boolean = hasDataRes.data.data;
		console.log("Has transaction data:", hasData);

		// Get list of available categories for transactions
		const categoriesRes = await listTransactionCategories();
		const categories: string[] = categoriesRes.data.data;
		console.log("Available categories:", categories);

		// Get all transactions with filters
		const txRes = await getAllTransactions({
			limit: 20,
			cursor: 0,
			sortDir: "desc",
			sortField: "date",
		});
		const { items, nextCursor } = txRes.data.data;
		console.log("Transactions:", { count: items.length, nextCursor });

		// Count transactions matching filters
		const countRes = await countTransactions({
			type: "EXPENSE",
		});
		const count: number = countRes.data.data;
		console.log("Expense count:", count);
	} catch (error) {
		console.error("Transaction error:", error);
	}
}

// Example 4: Hashtag management
async function exampleHashtags() {
	try {
		// List user hashtags
		const listRes = await listHashtags();
		const hashtags: Hashtag[] = listRes.data.data;
		console.log("User hashtags:", hashtags);

		// Set hashtags on a transaction
		const setRes = await setHashtagsOnTransaction({
			transactionId: "tx-123",
			hashtags: ["#groceries", "#food"],
		});
		console.log("Hashtags set:", setRes.data.data);
	} catch (error) {
		console.error("Hashtag error:", error);
	}
}

// Usage in a React component
export function ApiClientExample() {
	return (
		<div>
			<button onClick={() => exampleDemoMode()}>Test
	Demo;
	Mode < />bnottu < button;
	onClick={() => exampleCategories()}>Test
	Categories < />bnottu < button;
	onClick={() => exampleTransactions()}>Test
	Transactions < />bnottu < button;
	onClick={() => exampleHashtags()}>Test
	Hashtags < />bnottu < />div;
	)
}
