# Moat Finance — Mission

## What is Moat Finance?

Moat Finance is the financial data layer and operating system for personal AI agents — a unified platform where every part of a user’s financial life can be securely stored, understood, and acted on.

Moat Finance connects real bank accounts, investments, assets, liabilities, insurance policies, taxes, budgets, cash flow, and financial goals into a single continuously updated financial graph. It gives both users and AI agents deep, long-term financial context to model scenarios, surface insights, automate workflows, and make smarter decisions over time.

Built across web, mobile, and eventually local-first desktop environments with optional on-device AI models, Moat Finance is designed to give users full ownership, portability, and intelligence over their financial future.

While most financial apps focus on a single category — budgeting, investing, taxes, or wealth management — Moat Finance aims to become the canonical source of truth for a user’s entire financial story.

## Who is it for?

People who:
- Want more than a simple budget tracker — they want visibility into cash flow trends, forecasts, and the real shape of their finances
- Have multiple accounts and want a unified view
- Care about categorization accuracy and want to teach their tools how they think about spending
- Want to explore app features without commitment (demo mode)

## What success looks like in 12 months

- A user opens Moat Finance and within 30 seconds understands their net cash position, biggest spending categories, and whether they're on track for their goals
- Categorization is accurate enough that users trust the numbers without manual correction
- Goals are a first-class feature: users can see how saving for something affects their monthly cash flow
- Apple Wallet / FinanceKit data syncs alongside Plaid data seamlessly on iOS
- The MCP gateway lets power users query their financial data from ChatGPT, Claude, Cursor, and other LLM tools
- The Chrome extension makes retail order data a first-class input alongside bank transactions

## Surfaces

| Surface | What it does |
|---------|-------------|
| Web app (`apps/web`) | Primary dashboard: accounts, transactions, rules, forecasts, goals |
| iOS app (`apps/ios`) | Native mobile experience + Apple Wallet / FinanceKit integration |
| Chrome extension (`apps/extension`) | Retail order import from Amazon, Walmart, Target |
| MCP server (`apps/mcp`) | LLM gateway: query financial data from Claude / Cursor / ChatGPT |
| Marketing site (`apps/marketing`) | Public landing page and product overview |

## What Moat Finance is not

- Not a fully automated set-it-and-forget-it tool — it's for engaged users who want control
- Not a replacement for professional financial advice
- Not a trading or investment platform
