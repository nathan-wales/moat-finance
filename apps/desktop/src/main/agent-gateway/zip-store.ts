function u16(value: number): Buffer {
	const buf = Buffer.alloc(2);
	buf.writeUInt16LE(value, 0);
	return buf;
}

function u32(value: number): Buffer {
	const buf = Buffer.alloc(4);
	buf.writeUInt32LE(value >>> 0, 0);
	return buf;
}

function makeCrcTable(): Uint32Array {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[i] = c >>> 0;
	}
	return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(data: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		const tableValue = CRC_TABLE[(crc ^ byte) & 0xff];
		if (tableValue === undefined) {
			throw new Error("CRC table lookup failed");
		}
		crc = tableValue ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

export type ZipEntry = {
	path: string;
	data: Buffer;
};

/** Minimal store-only ZIP writer (no compression) for generating `.mcpb` archives. */
export function createStoredZip(entries: ZipEntry[]): Buffer {
	const localParts: Buffer[] = [];
	const centralParts: Buffer[] = [];
	let offset = 0;

	for (const entry of entries) {
		const name = Buffer.from(entry.path.replace(/\\/g, "/"), "utf8");
		const data = entry.data;
		const checksum = crc32(data);
		const localHeader = Buffer.concat([
			u32(0x04034b50),
			u16(20),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(checksum),
			u32(data.length),
			u32(data.length),
			u16(name.length),
			u16(0),
			name,
			data,
		]);

		const centralHeader = Buffer.concat([
			u32(0x02014b50),
			u16(20),
			u16(20),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(checksum),
			u32(data.length),
			u32(data.length),
			u16(name.length),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(0),
			u32(offset),
			name,
		]);

		localParts.push(localHeader);
		centralParts.push(centralHeader);
		offset += localHeader.length;
	}

	const centralDirectory = Buffer.concat(centralParts);
	const end = Buffer.concat([
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(entries.length),
		u16(entries.length),
		u32(centralDirectory.length),
		u32(offset),
		u16(0),
	]);

	return Buffer.concat([...localParts, centralDirectory, end]);
}
