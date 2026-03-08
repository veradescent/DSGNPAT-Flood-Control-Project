/********************
Last name: MONLOY
Language: Javascript
Paradigm(s): Object-Oriented (Template Method Pattern)
********************/

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as readline from 'node:readline/promises';
import fs from 'node:fs';
import path from 'node:path';

import { Report1Generator } from './reports/Report1Generator.js';
import { Report2Generator } from './reports/Report2Generator.js';
import { Report3Generator } from './reports/Report3Generator.js';

const r1 = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let checkRows = null;           // Checker for unloaded CSV file
let cleanedFilteredRows = null; // Store cleaned and filtered rows
let filtered = null;            // Keep track of number of filtered rows

// ─────────────────────────────────────────────
// MAIN MENU
// ─────────────────────────────────────────────

async function MainMenu() {
    console.log("\nSelect Language Implementation:");
    console.log("[1] Load the file");
    console.log("[2] Generate Reports");
    console.log("[3] Exit");
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
                console.log("Exiting the program. Goodbye!");
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

// ─────────────────────────────────────────────
// FILE LOADING & CLEANING
// ─────────────────────────────────────────────

// If user selects load file
async function loadFile() {
    const filename = 'dpwh_flood_control_projects.csv';
    const candidates = [
        path.resolve(process.cwd(), filename),
        path.resolve(process.cwd(), 'Javascript', filename)
    ];

    let filePath = null;
    for (const p of candidates) {
        try {
            await fs.promises.access(p);
            filePath = p;
            break;
        } catch (e) { }
    }

    if (!filePath) {
        console.log(`File '${filename}' not found in working directory or ./Javascript.`);
        await r1.question("Press Enter to return to menu...");
        await MainMenu();
        return;
    }

    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const rows = parse(content, { skip_empty_lines: true });
        checkRows = rows;

        const totalRows = rows.length;
        await filterAndCleanCSV();
        console.log(`Processing dataset... (${Math.max(0, totalRows - 1)} records loaded, ${filtered.length} filtered for 2021-2023)`);
    } catch (err) {
        console.error("Error reading/parsing file:", err.message || err);
    }

    await MainMenu();
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
    const fundingYearIdx = header.findIndex(h => String(h).toLowerCase().trim() === 'fundingyear');
    const budgetIdx = header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract'));
    const costIdx = header.findIndex(h => String(h).toLowerCase().includes('contractcost'));

    if (fundingYearIdx === -1 || budgetIdx === -1 || costIdx === -1) {
        console.log("Columns not found in the dataset.");
        await r1.question("Press Enter to return to menu...");
        await MainMenu();
        return;
    }

    const isClusteredOrNonNumeric = (cell) => {
        if (cell === undefined || cell === null) return true;
        const s = String(cell).trim();
        if (s === '') return true;
        if (/clustered/i.test(s) || /MYCA/i.test(s)) return true;
        const cleaned = s.replace(/[^0-9.\-]/g, '');
        if (cleaned === '') return true;
        const n = parseFloat(cleaned);
        return Number.isNaN(n);
    };

    const records = checkRows.slice(1);
    filtered = records.filter(row => {
        const raw = row[fundingYearIdx];
        const year = parseInt(String(raw).trim().replace(/\D/g, ''), 10);
        return !isNaN(year) && year >= 2021 && year <= 2023;
    });

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

    const colIdx = {};
    for (const key of Object.keys(requiredCols)) {
        const aliases = requiredCols[key];
        colIdx[key] = header.findIndex(h => {
            const lh = String(h).toLowerCase();
            return aliases.some(a => lh.includes(a));
        });
        if (colIdx[key] === -1) {
            console.warn(`Warning: column for ${key} not found in dataset; skipping null-check for this column.`);
        }
    }

    const cleaned = filtered.filter(row => {
        if (budgetIdx >= 0 && isClusteredOrNonNumeric(row[budgetIdx])) return false;
        if (costIdx >= 0 && isClusteredOrNonNumeric(row[costIdx])) return false;

        if (colIdx.StartDate >= 0) {
            const v = String(row[colIdx.StartDate] ?? '').trim();
            if (!v || isNaN(new Date(v))) return false;
        }
        if (colIdx.CompletionDate >= 0) {
            const v = String(row[colIdx.CompletionDate] ?? '').trim();
            if (!v || isNaN(new Date(v))) return false;
        }
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

    cleanedFilteredRows = [header, ...cleaned];

    const outPath = path.resolve('dpwh_flood_control_projects_2021_2023.csv');
    const output = stringify(cleanedFilteredRows);
    await fs.promises.writeFile(outPath, output, 'utf8');
}

// ─────────────────────────────────────────────
// SUMMARY (unchanged — not part of report template)
// ─────────────────────────────────────────────

async function generateSummary() {
    if (!cleanedFilteredRows || cleanedFilteredRows.length < 2) return null;

    const header = cleanedFilteredRows[0] || [];
    const records = cleanedFilteredRows.slice(1);

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

    const contractorIdx = header.findIndex(h => String(h).toLowerCase().includes('contractor'));
    const budgetIdx = header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract'));
    const costIdx = header.findIndex(h => String(h).toLowerCase().includes('contractcost'));
    const startDateIdx = header.findIndex(h => String(h).toLowerCase().includes('startdate'));
    const actualCompletionDateIdx = header.findIndex(h => String(h).toLowerCase().includes('actualcompletiondate'));
    const provinceIdx = header.findIndex(h => String(h).toLowerCase().includes('province'));

    let totalProjects = 0;
    const contractorsSet = new Set();
    const provincesSet = new Set();
    let totalSavings = 0;
    let delaySum = 0;
    let delayCount = 0;

    for (const row of records) {
        totalProjects += 1;

        if (contractorIdx >= 0) {
            const name = String(row[contractorIdx] ?? '').trim();
            if (name) contractorsSet.add(name);
        }
        if (provinceIdx >= 0) {
            const prov = String(row[provinceIdx] ?? '').trim();
            if (prov) provincesSet.add(prov);
        }

        const budget = budgetIdx >= 0 ? parseNumber(row[budgetIdx]) : 0;
        const cost = costIdx >= 0 ? parseNumber(row[costIdx]) : 0;
        totalSavings += (budget - cost);

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

    const globalAvgDelay = delayCount > 0 ? delaySum / delayCount : 0;

    const summary = {
        totalProjects,
        totalContractors: contractorsSet.size,
        totalProvincesWithProjects: provincesSet.size,
        globalAverageDelayDays: Number(globalAvgDelay.toFixed(2)),
        totalSavings: Number(totalSavings.toFixed(2))
    };

    const outPath = path.resolve('summary.json');
    await fs.promises.writeFile(outPath, JSON.stringify(summary, null, 2), 'utf8');

    return { summary, outPath };
}

// ─────────────────────────────────────────────
// GENERATE ALL REPORTS — uses Template Method via subclasses
// ─────────────────────────────────────────────

async function generateReports() {
    if (!cleanedFilteredRows || cleanedFilteredRows.length < 2) {
        console.log("No cleaned dataset available. Please load and filter the file first.");
        await r1.question("Press Enter to return to menu...");
        await MainMenu();
        return;
    }

    console.log("Generating reports...");
    console.log("cleanedFilteredRows length:", cleanedFilteredRows?.length);

    const r1g = new Report1Generator(cleanedFilteredRows);
    console.log("After construction, r1g.cleanedFilteredRows: ", r1g.cleanedFilteredRows?.length);
    await r1g.generate();
    await new Report2Generator(cleanedFilteredRows).generate();
    await new Report3Generator(cleanedFilteredRows).generate();

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