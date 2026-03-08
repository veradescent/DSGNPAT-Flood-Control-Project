import { ReportGenerator } from "./ReportGenerator.js";

export class Report3Generator extends ReportGenerator {
    
    getReportName() {
        return 'Report 3: Annual Project Type Cost Overrun Trends';
    }

    getReportTitle() {
        return 'Annual Project Type Cost Overrun Trends';
    }

    getReportSubtitle() {
        return '(Grouped by FundingYear and TypeOfWork)';
    }

    getOutputFilename() {
        return 'report3_annual_trends.csv';
    }

    retrieveIndices(header) {
        return {
            yearIdx: header.findIndex(h => String(h).toLowerCase().includes('fundingyear')),
            typeIdx: header.findIndex(h => {
                const s = String(h).toLowerCase();
                return s.includes('typeofwork') || s.includes('type of work') || (s.includes('type') && s.includes('work'));
            }),
            budgetIdx: header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract')),
            costIdx: header.findIndex(h => String(h).toLowerCase().includes('contractcost')),
        };
    }

    validateIndices(indices) {
        const { yearIdx, typeIdx, budgetIdx, costIdx } = indices;
        if (yearIdx === -1 || typeIdx === -1 || budgetIdx === -1 || costIdx === -1) {
            console.log('Required columns not found for Report 3: FundingYear, TypeOfWork, ApprovedBudgetForContract, ContractCost');
            return false;
        }
        return true;
    }

    aggregateData(records, indices) {
        const { yearIdx, typeIdx, budgetIdx, costIdx } = indices;

        // Group by year + TypeOfWork
        const groups = {};
        records.forEach(row => {
            const yearRaw = String(row[yearIdx] ?? '').trim();
            const year = parseInt(yearRaw.replace(/\D/g, ''), 10);
            if (isNaN(year)) return;

            const type = String(row[typeIdx] ?? '').trim() || 'UNKNOWN';
            const budget = this.parseNumber(row[budgetIdx]);
            const cost = this.parseNumber(row[costIdx]);
            const saving = budget - cost; // positive = savings, negative = overrun

            const key = `${year}|${type}`;
            if (!groups[key]) groups[key] = { year, type, count: 0, sumSavings: 0, overrunCount: 0 };
            groups[key].count       += 1;
            groups[key].sumSavings  += saving;
            if (saving < 0) groups[key].overrunCount += 1;
        });

        // Compute per-group metrics
        const list = Object.values(groups).map(g => ({
            year: g.year,
            type: g.type,
            totalProjects: g.count,
            avgSavings: g.count ? g.sumSavings / g.count : 0,
            overrunRate: g.count ? (g.overrunCount / g.count) * 100 : 0,
        }));

        // Compute 2021 baseline avgSavings per TypeOfWork for YoY calculation
        const baselineByType = {};
        list.forEach(item => {
            if (item.year === 2021) baselineByType[item.type] = item.avgSavings;
        });

        // Attach YoY change relative to each type's 2021 baseline
        const rowsWithYoY = list.map(item => {
            const baseline = baselineByType[item.type];
            let yoy = 'N/A';
            if (baseline !== undefined) {
                if (Math.abs(baseline) < 1e-9) {
                    yoy = Math.abs(item.avgSavings) < 1e-9 ? '0.00' : 'N/A'; // avoid division by zero
                } else {
                    yoy = (((item.avgSavings - baseline) / Math.abs(baseline)) * 100).toFixed(2);
                }
            }
            return { ...item, yoyChange: yoy };
        });

        return rowsWithYoY;
    }

    buildReportRows(rowsWithYoY) {
        const reportHeader = ['FundingYear', 'TypeOfWork', 'TotalProjects', 'AvgSavings', 'OverrunRate', 'YoYChange'];

        const reportRows = rowsWithYoY.map(r => [
            r.year.toString(),
            r.type,
            r.totalProjects.toString(),
            r.avgSavings.toFixed(2),
            r.overrunRate.toFixed(2),
            String(r.yoyChange)
        ]);

        return { reportHeader, reportRows };
    }

    sortRows(rows) {
        // Sort by year ascending, then avgSavings (index 3) descending
        return rows.sort((a, b) => {
            const yearDiff = parseInt(a[0]) - parseInt(b[0]);
            if (yearDiff !== 0) return yearDiff;
            return parseFloat(b[3]) - parseFloat(a[3]);
        });
    }
}