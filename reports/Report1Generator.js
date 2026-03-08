import { ReportGenerator } from "./ReportGenerator.js";

export class Report1Generator extends ReportGenerator {

    getReportName() {
        return 'Report 1: Regional Flood Mitigation Efficiency Summary';
    }

    getReportTitle() {
        return 'Regional Flood Mitigation Efficiency Summary';
    }

    getReportSubtitle() {
        return '(Filtered: 2021-2023 Projects)';
    }

    getOutputFilename() {
        return 'report1_regional_summary.csv';
    }

    retrieveIndices(header) {
        return {
            regionIdx: header.findIndex(h => String(h).toLowerCase().includes('region')),
            mainIslandIdx: header.findIndex(h => String(h).toLowerCase().includes('mainisland')),
            budgetIdx: header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract')),
            costIdx: header.findIndex(h => String(h).toLowerCase().includes('contractcost')),
            startDateIdx: header.findIndex(h => String(h).toLowerCase().includes('startdate')),
            actualCompletionDateIdx: header.findIndex(h => String(h).toLowerCase().includes('actualcompletiondate'))
        };
    }

    validateIndices(indices) {
        const { regionIdx, mainIslandIdx, budgetIdx, costIdx, startDateIdx, actualCompletionDateIdx } = indices;
        if (regionIdx === -1 || mainIslandIdx === -1 || budgetIdx === -1 || costIdx === -1 || startDateIdx === -1 || actualCompletionDateIdx === -1) {
            console.log("Required columns not found: Region, MainIsland, ApprovedBudgetForContract, ContractCost, StartDate, ActualCompletionDate");
            return false;
        }

        return true;
    }

    aggregateData(records, indices) {
        const { regionIdx, mainIslandIdx, budgetIdx, costIdx, startDateIdx, actualCompletionDateIdx } = indices;

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
            const delayDays = this.calculateDelayDays(
                String(row[startDateIdx] ?? ''),
                String(row[actualCompletionDateIdx] ?? '')
            );

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

        return intermediate;
    }

    buildReportRows(intermediate) {
        const reportHeader = ['Region', 'MainIsland', 'Total Budget', 'MedianSavings', 'AvgDelay', 'HighDelayPct', 'EfficiencyScore'];

        // Determine min/max for normalization (ignore infinite values for min/max decision)
        const finiteEffs = intermediate.map(i => i.rawEfficiency).filter(v => Number.isFinite(v));
        const minEff = finiteEffs.length ? Math.min(...finiteEffs) : 0;
        const maxEff = finiteEffs.length ? Math.max(...finiteEffs) : 0;

        // Build final report rows with normalized efficiency 0-100
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

        return { reportHeader, reportRows };
    }

    sortRows(rows) {
        // Sort by normalized EfficiencyScore descending
        return rows.sort((a, b) => parseFloat(b[6]) - parseFloat(a[6]));
    }
}