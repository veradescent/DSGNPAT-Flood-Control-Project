/********************
Last name: MONLOY
Language: Javascript
Paradigm(s): 
********************/

import { parse } from 'csv-parse/sync'; // Parse CSV file
import { stringify } from 'csv-stringify/sync'; // Build CSV output
import * as readline from 'node:readline/promises'; // Allow input from user
import fs from 'node:fs';
import path from 'node:path';

const r1 = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let checkRows = null; // Checker for unloaded CSV file
let cleanedFilteredRows = null; // Store cleaned and filtered rows
let filtered = null; // Keep track number of filtered rows

// Print main menu
async function MainMenu() {
    console.log("\nSelect Language Implementation:");
    console.log("[1] Load the file")
    console.log("[2] Generate Reports");
    console.log("[3] Exit")
    try {
        const choice = await r1.question("\nEnter choice: ");
        switch (choice) {
            case '1':
                await loadFile();
                break;
            case '2':
                await generateReports();
                break;
            case '3':
                console.log("Exiting the program. Goodbye!")
                r1.close();
                process.exit(0);
            default:
                console.log("Invalid choice. Please try again.");
                await MainMenu();
        }
    } catch (error) {
        console.error("Error in MainMenu:", error);
    }
}

// Filtering rows from 2021 to 2023, removing null values and non-numeric rows in supposed numeric fields
async function filterAndCleanCSV() {
    if (!checkRows) {
        console.log("No dataset loaded. Please choose 'Load the file' first.");
        await r1.question("Press Enter to return to menu...");
        await MainMenu();
        return;
    }

    const header = checkRows[0] || [];
    const fundingYearIdx = header.findIndex(h => String(h).toLowerCase().trim() === 'fundingyear'); // Retrieve funding year
    const budgetIdx = header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract')); // Retrieve budget
    const costIdx = header.findIndex(h => String(h).toLowerCase().includes('contractcost')); // Retrieve cost

    if (fundingYearIdx === -1 || budgetIdx === -1 || costIdx === -1) {
        console.log("Columns not found in the dataset.");
        await r1.question("Press Enter to return to menu...");
        await MainMenu();
        return;
    }

    // Check if budget and cost column is clustered or non-numeric
    const isClusteredOrNonNumeric = (cell) => {
        if (cell === undefined || cell === null) return true; // If null
        const s = String(cell).trim();
        if (s === '') return true; // If value is whitespace
        
        if (/clustered/i.test(s) || /MYCA/i.test(s)) return true; // If clustered
        
        const cleaned = s.replace(/[^0-9.\-]/g, ''); // If number is invalid
        if (cleaned === '') return true;
        const n = parseFloat(cleaned);
        return Number.isNaN(n); // If value is not a number
    };

    // Store filtered records from 2021 to 2023
    const records = checkRows.slice(1);
    filtered = records.filter(row => {
        const raw = row[fundingYearIdx];
        const year = parseInt(String(raw).trim().replace(/\D/g, ''), 10);
        return !isNaN(year) && year >= 2021 && year <= 2023;
    });

    // Set required columns to find in CSV
    const requiredCols = {
        StartDate: ['startdate'],
        CompletionDate: ['actualcompletiondate'],
        ApprovedBudgetForContract: ['approvedbudgetforcontract'],
        ContractCost: ['contractcost'],
        Region: ['region'],
        MainIsland: ['mainisland'],
        FundingYear: ['fundingyear'],
        Contractor: ['contractor'],
        ContractorCount: ['contractorcount'],
        TypeOfWork: ['typeofwork'],
        ProjectID: ['projectid'],
        ProjectName: ['projectname'],
        Province: ['province']
    };

    // Find required columns in CSV file
    const colIdx = {};
    for (const key of Object.keys(requiredCols)) {
        const aliases = requiredCols[key];
        colIdx[key] = header.findIndex(h => {
            const lh = String(h).toLowerCase(); // Set to case-insensitive
            return aliases.some(a => lh.includes(a));
        });
        if (colIdx[key] === -1) {
            console.warn(`Warning: column for ${key} not found in dataset; skipping null-check for this column.`);
        }
    }

    // Clean filtered rows
    const cleaned = filtered.filter(row => {
        // Check numeric budget/cost if not clustered or invalid
        if (budgetIdx >= 0 && isClusteredOrNonNumeric(row[budgetIdx])) return false;
        if (costIdx >= 0 && isClusteredOrNonNumeric(row[costIdx])) return false;

        // Parse to valid dates
        if (colIdx.StartDate >= 0) {
            const v = String(row[colIdx.StartDate] ?? '').trim();
            if (!v) return false;
            if (isNaN(new Date(v))) return false;
        }

        if (colIdx.CompletionDate >= 0) {
            const v = String(row[colIdx.CompletionDate] ?? '').trim();
            if (!v) return false;
            if (isNaN(new Date(v))) return false;
        }

        // Additional numeric checks
        if (colIdx.FundingYear >= 0) {
            const v = String(row[colIdx.FundingYear] ?? '').trim();
            if (!v || isNaN(parseInt(v.replace(/\D/g, ''), 10))) return false;
        }
        if (colIdx.ContractorCount >= 0) {
            const v = String(row[colIdx.ContractorCount] ?? '').trim();
            if (!v || isNaN(parseInt(v.replace(/\D/g, ''), 10))) return false;
        }

        if (colIdx.ApprovedBudgetForContract >= 0) {
            const v = String(row[colIdx.ApprovedBudgetForContract] ?? '').trim();
            if (!v) return false;
        }
        if (colIdx.ContractCost >= 0) {
            const v = String(row[colIdx.ContractCost] ?? '').trim();
            if (!v) return false;
        }

        const stringFields = ['Region', 'MainIsland', 'Contractor', 'TypeOfWork', 'ProjectID', 'ProjectName', 'Province'];
        for (const f of stringFields) {
            const i = colIdx[f];
            if (i >= 0) {
                const v = String(row[i] ?? '').trim();
                if (!v) return false;
            }
        }

        return true;
    });

    cleanedFilteredRows = [header, ...cleaned]; // Store cleaned and filtered rows

    const outPath = path.resolve('dpwh_flood_control_projects_2021_2023.csv');
    const output = stringify(cleanedFilteredRows);

    await fs.promises.writeFile(outPath, output, 'utf8');
}

// If user selects load file
async function loadFile() {
    const filename = 'dpwh_flood_control_projects.csv';
    const candidates = [ // Check possible locations of CSV file
        path.resolve(process.cwd(), filename),
        path.resolve(process.cwd(), 'Javascript', filename)
    ];

    // Find CSV file in indicated path
    let filePath = null;
    for (const p of candidates) {
        try {
            await fs.promises.access(p);
            filePath = p;
            break;
        } catch (e) {
            
        }
    }

    // If file is not found
    if (!filePath) {
        console.log(`File '${filename}' not found in working directory or ./Javascript.`);
        await r1.question("Press Enter to return to menu...");
        await MainMenu();
        return;
    }

    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const rows = parse(content, { skip_empty_lines: true });
        // Store parsed rows for later filtering
        checkRows = rows;

        const totalRows = rows.length; // Total row count
        await filterAndCleanCSV(); 
        console.log(`Processing dataset... (${Math.max(0, totalRows - 1)} records loaded, ${filtered.length} filtered for 2021-2023)`);
        
    } catch (err) {
        console.error("Error reading/parsing file:", err.message || err);
    }

    await MainMenu();
}

// Helper function for printing display of reports table
function printTable(header, rows) {
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

// Generate Report 1
async function generateReport1() {
    const header = cleanedFilteredRows[0] || [];
    const records = cleanedFilteredRows.slice(1);

    // Retrieve indices
    const regionIdx = header.findIndex(h => String(h).toLowerCase().includes('region'));
    const mainIslandIdx = header.findIndex(h => String(h).toLowerCase().includes('mainisland'));
    const budgetIdx = header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract'));
    const costIdx = header.findIndex(h => String(h).toLowerCase().includes('contractcost'));
    const startDateIdx = header.findIndex(h => String(h).toLowerCase().includes('startdate'));
    const actualCompletionDateIdx = header.findIndex(h => String(h).toLowerCase().includes('actualcompletiondate'));

    if (regionIdx === -1 || mainIslandIdx === -1 || budgetIdx === -1 || costIdx === -1 || startDateIdx === -1 || actualCompletionDateIdx === -1) {
        console.log("Required columns not found: Region, MainIsland, ApprovedBudgetForContract, ContractCost, StartDate, ActualCompletionDate");
        return;
    }

    // Calculate delay days
    const calculateDelayDays = (startDateStr, actualCompletionDateStr) => {
        try {
            const startDate = new Date(startDateStr);
            const actualCompletionDate = new Date(actualCompletionDateStr);
            if (isNaN(startDate) || isNaN(actualCompletionDate)) return 0;
            const delayMs = actualCompletionDate - startDate;
            return Math.floor(delayMs / (1000 * 60 * 60 * 24));
        } catch (e) {
            return 0;
        }
    };

    // Group by Region + MainIsland
    const groups = {};
    records.forEach(row => {
        const region = String(row[regionIdx] ?? '').trim();
        const island = String(row[mainIslandIdx] ?? '').trim();
        const key = `${region}|${island}`;

        if (!groups[key]) {
            groups[key] = { region, island, budgets: [], savings: [], delays: [] };
        }

        const budget = parseFloat(row[budgetIdx]) || 0;
        const cost = parseFloat(row[costIdx]) || 0;
        const saving = budget - cost;
        const delayDays = calculateDelayDays(String(row[startDateIdx] ?? ''), String(row[actualCompletionDateIdx] ?? ''));

        groups[key].budgets.push(budget);
        groups[key].savings.push(saving);
        groups[key].delays.push(delayDays);
    });

    // Build intermediate results with raw efficiency
    const intermediate = Object.values(groups).map(g => {
        const totalBudget = g.budgets.reduce((a, b) => a + b, 0);
        const sortedSavings = [...g.savings].sort((a, b) => a - b);
        const medianSavings = sortedSavings.length % 2 === 0
            ? (sortedSavings[sortedSavings.length / 2 - 1] + sortedSavings[sortedSavings.length / 2]) / 2
            : sortedSavings[Math.floor(sortedSavings.length / 2)];
        const avgDelay = g.delays.length > 0 ? g.delays.reduce((a, b) => a + b, 0) / g.delays.length : 0;

        // raw efficiency (keep as number, handle avgDelay == 0)
        const rawEfficiency = avgDelay > 0 ? (medianSavings / avgDelay) * 100 : (medianSavings > 0 ? Number.POSITIVE_INFINITY : 0);

        return {
            region: g.region,
            island: g.island,
            totalBudget,
            medianSavings,
            avgDelay,
            highDelayPct: g.delays.length > 0 ? (g.delays.filter(d => d > 30).length / g.delays.length) * 100 : 0,
            rawEfficiency
        };
    });

    // Determine min/max for normalization (ignore infinite values for min/max decision)
    const finiteEffs = intermediate.map(i => i.rawEfficiency).filter(v => Number.isFinite(v));
    const minEff = finiteEffs.length ? Math.min(...finiteEffs) : 0;
    const maxEff = finiteEffs.length ? Math.max(...finiteEffs) : 0;

    // Build final report rows with normalized efficiency 0-100
    const reportHeader = ['Region', 'MainIsland', 'Total Budget', 'MedianSavings', 'AvgDelay', 'HighDelayPct', 'EfficiencyScore'];
    const reportRows = intermediate.map(i => {
        let normalized = 0;
        const raw = i.rawEfficiency;
        if (!Number.isFinite(raw)) {
            // if raw is Infinity (avgDelay==0 and positive medianSavings), give top score
            normalized = 100;
        } else if (maxEff === minEff) {
            normalized = raw > 0 ? 100 : 0;
        } else {
            normalized = ((raw - minEff) / (maxEff - minEff)) * 100;
            if (!Number.isFinite(normalized)) normalized = 0;
        }

        return [
            i.region,
            i.island,
            i.totalBudget.toFixed(2),
            i.medianSavings.toFixed(2),
            i.avgDelay.toFixed(2),
            i.highDelayPct.toFixed(2),
            normalized.toFixed(2)
        ];
    });

    // Sort by normalized EfficiencyScore descending
    reportRows.sort((a, b) => parseFloat(b[6]) - parseFloat(a[6]));

    // Display results
    console.log('\nReport 1: Regional Flood Mitigation Efficiency Summary');
    console.log('\nRegional Flood Mitigation Efficiency Summary');
    console.log('(Filtered: 2021-2023 Projects)');
    printTable(reportHeader, reportRows);

    // Store in CSV file
    const outPath = path.resolve('report1_regional_summary.csv');
    const output = stringify([reportHeader, ...reportRows]);
    await fs.promises.writeFile(outPath, output, 'utf8');
    console.log('\n(Full table exported to report1_regional_summary.csv)');
}

// Generate Report 2
async function generateReport2() {
    if (!cleanedFilteredRows || cleanedFilteredRows.length < 2) {
        console.log("No cleaned dataset available for Report 2. Please load and filter the file first.");
        return;
    }

    const header = cleanedFilteredRows[0] || [];
    const records = cleanedFilteredRows.slice(1);

    // Retrieve indices
    const contractorIdx = header.findIndex(h => String(h).toLowerCase().includes('contractor'));
    const costIdx = header.findIndex(h => String(h).toLowerCase().includes('contractcost'));
    const budgetIdx = header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract'));
    const startDateIdx = header.findIndex(h => String(h).toLowerCase().includes('startdate'));
    const actualCompletionDateIdx = header.findIndex(h => String(h).toLowerCase().includes('actualcompletiondate'));

    if (contractorIdx === -1 || costIdx === -1) {
        console.log("Required columns not found for Report 2: Contractors, ContractCost");
        return;
    }

    // Helper to parse numeric currency-like strings
    const parseNumber = v => {
        if (v === undefined || v === null) return 0;
        const s = String(v).trim();
        const cleaned = s.replace(/[^0-9.\-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
    };

    // Calculate delay days
    const calculateDelayDays = (startDateStr, actualCompletionDateStr) => {
        try {
            const startDate = new Date(startDateStr);
            const actualCompletionDate = new Date(actualCompletionDateStr);
            if (isNaN(startDate) || isNaN(actualCompletionDate)) return 0;
            const delayMs = actualCompletionDate - startDate;
            return Math.floor(delayMs / (1000 * 60 * 60 * 24));
        } catch (e) {
            return 0;
        }
    };

    // Aggregate per contractor
    const contractors = {};
    records.forEach(row => {
        const name = String(row[contractorIdx] ?? '').trim();
        if (!name) return;
        const cost = parseNumber(row[costIdx]);
        const budget = budgetIdx >= 0 ? parseNumber(row[budgetIdx]) : 0;
        const saving = budget - cost;
        const delayDays = (startDateIdx >= 0 && actualCompletionDateIdx >= 0)
            ? calculateDelayDays(String(row[startDateIdx] ?? ''), String(row[actualCompletionDateIdx] ?? ''))
            : 0;

        if (!contractors[name]) {
            contractors[name] = { name, totalCost: 0, numProjects: 0, delays: [], totalSavings: 0 };
        }
        contractors[name].totalCost += cost;
        contractors[name].numProjects += 1;
        contractors[name].delays.push(delayDays);
        contractors[name].totalSavings += saving;
    });

    // Filter contractors with >= 5 projects
    let contractorList = Object.values(contractors).filter(c => c.numProjects >= 5);

    // Rank by totalCost descending and take top 15
    contractorList.sort((a, b) => b.totalCost - a.totalCost);
    contractorList = contractorList.slice(0, 15);

    // Build report rows
    const reportHeader = ['Rank', 'Contractor', 'Total Cost', 'NumProjects', 'AvgDelay', 'TotalSavings', 'ReliabilityIndex', 'RiskFlag'];
    const reportRows = contractorList.map((c, idx) => {
        const avgDelay = c.delays.length ? c.delays.reduce((s, v) => s + v, 0) / c.delays.length : 0;

        let reliabilityIndex = 0;
        if (c.totalCost > 0) {
            const delayFactor = (1 - (avgDelay / 90));
            const savingsRatio = c.totalSavings / c.totalCost;
            reliabilityIndex = delayFactor * savingsRatio * 100;
        } else {
            reliabilityIndex = 0;
        }

        let riskFlag = 'Low Risk';
        if (reliabilityIndex < 50) riskFlag = 'High Risk';

        return [
            (idx + 1).toString(),
            c.name,
            c.totalCost.toFixed(2),
            c.numProjects.toString(),
            avgDelay.toFixed(2),
            c.totalSavings.toFixed(2),
            reliabilityIndex.toFixed(2),
            riskFlag
        ];
    });

    // Display results
    console.log('\nReport 2: Top Contractors Performance Ranking');
    console.log('\nTop Contractors Performance Ranking');
    console.log('(Top 15 by TotalCost, >=5 Projects)');
    printTable(reportHeader, reportRows);

    // Store in CSV file
    const outPath = path.resolve('report2_contractor_ranking.csv');
    const output = stringify([reportHeader, ...reportRows]);
    await fs.promises.writeFile(outPath, output, 'utf8');
    console.log('\n(Full table exported to report2_contractor_ranking.csv)');
}

// Generate Report 3
async function generateReport3() {
    if (!cleanedFilteredRows || cleanedFilteredRows.length < 2) {
        console.log("No cleaned dataset available for Report 3. Please load and filter the file first.");
        return;
    }

    const header = cleanedFilteredRows[0] || [];
    const records = cleanedFilteredRows.slice(1);

    const yearIdx = header.findIndex(h => String(h).toLowerCase().includes('fundingyear'));
    // try common variants for TypeOfWork column
    const typeIdx = header.findIndex(h => {
        const s = String(h).toLowerCase();
        return s.includes('typeofwork') || s.includes('type of work') || (s.includes('type') && s.includes('work'));
    });
    const budgetIdx = header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract'));
    const costIdx = header.findIndex(h => String(h).toLowerCase().includes('contractcost'));

    if (yearIdx === -1 || typeIdx === -1 || budgetIdx === -1 || costIdx === -1) {
        console.log("Required columns not found for Report 3: FundingYear, TypeOfWork, ApprovedBudgetForContract, ContractCost");
        return;
    }

    // Helper to parse numeric currency-like strings
    const parseNumber = v => {
        if (v === undefined || v === null) return 0;
        const s = String(v).trim();
        const cleaned = s.replace(/[^0-9.\-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
    };

    // Group by year & type
    const groups = {}; 
    records.forEach(row => {
        const yearRaw = String(row[yearIdx] ?? '').trim();
        const year = parseInt(yearRaw.replace(/\D/g, ''), 10);
        if (isNaN(year)) return;

        const type = String(row[typeIdx] ?? '').trim() || 'UNKNOWN';
        const budget = parseNumber(row[budgetIdx]);
        const cost = parseNumber(row[costIdx]);
        const saving = budget - cost; // positive => savings, negative => overrun

        const key = `${year}|${type}`;
        if (!groups[key]) groups[key] = { year, type, count: 0, sumSavings: 0, overrunCount: 0 };
        groups[key].count += 1;
        groups[key].sumSavings += saving;
        if (saving < 0) groups[key].overrunCount += 1;
    });

    // Build list and compute metrics
    const list = Object.values(groups).map(g => {
        const avgSavings = g.count ? g.sumSavings / g.count : 0;
        const overrunRate = g.count ? (g.overrunCount / g.count) * 100 : 0;
        return {
            year: g.year,
            type: g.type,
            totalProjects: g.count,
            avgSavings,
            overrunRate
        };
    });

    // Compute 2021 baseline avgSavings per TypeOfWork
    const baselineByType = {};
    list.forEach(item => {
        if (item.year === 2021) baselineByType[item.type] = item.avgSavings;
    });

    // Add YoYChange relative to 2021 baseline for same TypeOfWork
    const rowsWithYoY = list.map(item => {
        const baseline = baselineByType[item.type];
        let yoy = 'N/A';
        if (baseline !== undefined) {
            if (Math.abs(baseline) < 1e-9) {
                // baseline zero: if avg is also zero -> 0, else show N/A to avoid division by zero
                yoy = Math.abs(item.avgSavings) < 1e-9 ? '0.00' : 'N/A';
            } else {
                yoy = ((item.avgSavings - baseline) / Math.abs(baseline)) * 100;
                yoy = yoy.toFixed(2);
            }
        }
        return {
            year: item.year,
            type: item.type,
            totalProjects: item.totalProjects,
            avgSavings: item.avgSavings,
            overrunRate: item.overrunRate,
            yoyChange: yoy
        };
    });

    // Sort by year asc, then avgSavings desc
    rowsWithYoY.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return b.avgSavings - a.avgSavings;
    });

    // Prepare report rows
    const reportHeader = ['FundingYear', 'TypeOfWork', 'TotalProjects', 'AvgSavings', 'OverrunRate', 'YoYChange'];
    const reportRows = rowsWithYoY.map(r => [
        r.year.toString(),
        r.type,
        r.totalProjects.toString(),
        r.avgSavings.toFixed(2),
        r.overrunRate.toFixed(2),
        String(r.yoyChange)
    ]);

    // Display results
    console.log('\nReport 3: Annual Project Type Cost Overrun Trends');
    console.log('\nAnnual Project Type Cost Overrun Trends');
    console.log('(Grouped by FundingYear and TypeOfWork)');
    printTable(reportHeader, reportRows);

    // Store in CSV file
    const outPath = path.resolve('report3_annual_trends.csv');
    const output = stringify([reportHeader, ...reportRows]);
    await fs.promises.writeFile(outPath, output, 'utf8');
    console.log('\n(Full table exported to report3_annual_trends.csv)');
}

// Generate keys stats across reports
async function generateSummary() {
	// Require cleanedFilteredRows
	if (!cleanedFilteredRows || cleanedFilteredRows.length < 2) return null;

	const header = cleanedFilteredRows[0] || [];
	const records = cleanedFilteredRows.slice(1);

	// Helper to parse numeric currency-like strings
	const parseNumber = v => {
		if (v === undefined || v === null) return 0;
		const s = String(v).trim();
		const cleaned = s.replace(/[^0-9.\-]/g, '');
		const n = parseFloat(cleaned);
		return isNaN(n) ? 0 : n;
	};
	const parseDate = s => {
		const d = new Date(String(s || '').trim());
		return isNaN(d) ? null : d;
	};

    // Retrieve indices
	const contractorIdx = header.findIndex(h => String(h).toLowerCase().includes('contractor'));
	const budgetIdx = header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract'));
	const costIdx = header.findIndex(h => String(h).toLowerCase().includes('contractcost'));
	const startDateIdx = header.findIndex(h => String(h).toLowerCase().includes('startdate'));
	const actualCompletionDateIdx = header.findIndex(h => String(h).toLowerCase().includes('actualcompletiondate'));
	const provinceIdx = header.findIndex(h => String(h).toLowerCase().includes('province'));

	// Set aggregates
	let totalProjects = 0;
	const contractorsSet = new Set();
	const provincesSet = new Set();
	let totalSavings = 0;
	let delaySum = 0;
	let delayCount = 0;

	for (const row of records) {
		totalProjects += 1;

		// For contractors
		if (contractorIdx >= 0) {
			const name = String(row[contractorIdx] ?? '').trim();
			if (name) contractorsSet.add(name);
		}

		// For provinces
		if (provinceIdx >= 0) {
			const prov = String(row[provinceIdx] ?? '').trim();
			if (prov) provincesSet.add(prov);
		}

		// For savings
		const budget = budgetIdx >= 0 ? parseNumber(row[budgetIdx]) : 0;
		const cost = costIdx >= 0 ? parseNumber(row[costIdx]) : 0;
		totalSavings += (budget - cost);

		// For delay
		if (startDateIdx >= 0 && actualCompletionDateIdx >= 0) {
			const sd = parseDate(row[startDateIdx]);
			const ad = parseDate(row[actualCompletionDateIdx]);
			if (sd && ad) {
				const days = Math.floor((ad - sd) / (1000 * 60 * 60 * 24));
				delaySum += days;
				delayCount += 1;
			}
		}
	}

    // Compute global average delay
	const globalAvgDelay = delayCount > 0 ? (delaySum / delayCount) : 0;

    // Store summary 
	const summary = {
		totalProjects,
		totalContractors: contractorsSet.size,
		totalProvincesWithProjects: provincesSet.size,
		globalAverageDelayDays: Number(globalAvgDelay.toFixed(2)),
		totalSavings: Number(totalSavings.toFixed(2))
	};

    // Store in summary.json
	const outPath = path.resolve('summary.json');
	await fs.promises.writeFile(outPath, JSON.stringify(summary, null, 2), 'utf8');

	return { summary, outPath };
}

// Generate all reports
async function generateReports() {
    if (!cleanedFilteredRows || cleanedFilteredRows.length < 2) {
        console.log("No cleaned dataset available. Please load and filter the file first.");
        await r1.question("Press Enter to return to menu...");
        await MainMenu();
        return;
    }

    console.log("Generating reports...");
    
    await generateReport1();
    await generateReport2();
    await generateReport3();

    try {
        const res = await generateSummary();
        if (res && res.summary) {
            console.log('\nSummary Stats (summary.json)');
            console.log(JSON.stringify(res.summary, null, 2));
        } else {
            console.log("\nNo summary generated.");
        }
    } catch (err) {
        console.error("Error generating summary:", err);
    }
    
    await r1.question("\nPress Enter to return to menu...");
    await MainMenu();
}

MainMenu();