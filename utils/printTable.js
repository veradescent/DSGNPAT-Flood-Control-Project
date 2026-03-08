// Helper function for printing display of reports table
export function printTable(header, rows) {
	const cols = header.length;
	const widths = new Array(cols).fill(0);

	for (let c = 0; c < cols; c++) {
		widths[c] = Math.max(widths[c], String(header[c]).length);
	}

	for (const r of rows) {
		for (let c = 0; c < cols; c++) {
			const cell = r[c] === undefined || r[c] === null ? '' : String(r[c]);
			widths[c] = Math.max(widths[c], cell.length);
		}
	}

	const sep = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
	const pad = (s, w) => {
		const str = String(s === undefined || s === null ? '' : s);
		return ' ' + str + ' '.repeat(w - str.length + 1);
	};
	// header
	console.log(sep);
	console.log('|' + header.map((h, i) => pad(h, widths[i])).join('|') + '|');
	console.log(sep);
	// rows
	for (const r of rows) {
		console.log('|' + header.map((_, i) => pad(r[i], widths[i])).join('|') + '|');
	}
	console.log(sep);
}