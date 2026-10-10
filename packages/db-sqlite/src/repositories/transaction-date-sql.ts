/**
 * Prisma SQLite stores DateTime either as unix-ms INTEGER (Date objects) or
 * ISO TEXT (string writes). SQLite compares INTEGER vs TEXT by coercing the
 * number to text, so `1784505600000 >= '2024-08-01T…'` is false
 * ("1784…" < "2024…"). Normalize to ms before filtering/grouping.
 */

/** Effective transaction timestamp in unix milliseconds. */
export const TX_EFFECTIVE_MS_SQL = `CASE typeof(COALESCE(t.postedDate, t.date))
	WHEN 'integer' THEN COALESCE(t.postedDate, t.date)
	ELSE CAST(strftime('%s', COALESCE(t.postedDate, t.date)) AS INTEGER) * 1000
END`;

/** YYYY-MM month key from the effective timestamp. */
export const TX_MONTH_SQL = `strftime('%Y-%m', (${TX_EFFECTIVE_MS_SQL}) / 1000, 'unixepoch')`;

/** Monday-start week bucket as YYYY-MM-DD from the effective timestamp. */
export const TX_WEEK_SQL = `strftime(
	'%Y-%m-%d',
	(${TX_EFFECTIVE_MS_SQL}) / 1000,
	'unixepoch',
	'-' || ((CAST(strftime('%w', (${TX_EFFECTIVE_MS_SQL}) / 1000, 'unixepoch') AS INTEGER) + 6) % 7) || ' days'
)`;
