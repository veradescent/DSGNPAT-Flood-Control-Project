import { ReportGenerator } from "./ReportGenerator.js";

export class Report2Generator extends ReportGenerator {
    
    getReportName() {
        return 'Report 2: Top Contractors Performance Ranking';
    }

    getReportTitle() {
        return 'Top Contractors Performance Ranking';
    }

    getReportSubtitle() {
        return '(Top 15 by TotalCost, >=5 Projects)';
    }

    getOutputFilename() {
        return 'report2_contractor_ranking.csv';
    }

    retrieveIndices(header) {
        return {
            contractorIdx: header.findIndex(h => String(h).toLowerCase().includes('contractor')),
            costIdx: header.findIndex(h => String(h).toLowerCase().includes('contractcost')),
            budgetIdx: header.findIndex(h => String(h).toLowerCase().includes('approvedbudgetforcontract')),
            startDateIdx: header.findIndex(h => String(h).toLowerCase().includes('startdate')),
            actualCompletionDateIdx: header.findIndex(h => String(h).toLowerCase().includes('actualcompletiondate')),
        };
    }

    validateIndices(indices) {
        const { contractorIdx, costIdx } = indices;
        if (contractorIdx === -1 || costIdx === -1) {
            console.log('Required columns not found for Report 2: Contractors, ContractCost');
            return false;
        }
        return true;
    }

    aggregateData(records, indices) {
        const { contractorIdx, costIdx, budgetIdx, startDateIdx, actualCompletionDateIdx } = indices;

        // Aggregate per contractor
        const contractors = {};
        records.forEach(row => {
            const name = String(row[contractorIdx] ?? '').trim();
            if (!name) return;

            const cost    = this.parseNumber(row[costIdx]);
            const budget  = budgetIdx >= 0 ? this.parseNumber(row[budgetIdx]) : 0;
            const saving  = budget - cost;
            const delayDays = (startDateIdx >= 0 && actualCompletionDateIdx >= 0)
                ? this.calculateDelayDays(
                    String(row[startDateIdx] ?? ''),
                    String(row[actualCompletionDateIdx] ?? '')
                  )
                : 0;

            if (!contractors[name]) {
                contractors[name] = { name, totalCost: 0, numProjects: 0, delays: [], totalSavings: 0 };
            }
            contractors[name].totalCost    += cost;
            contractors[name].numProjects  += 1;
            contractors[name].delays.push(delayDays);
            contractors[name].totalSavings += saving;
        });

        // Filter to >= 5 projects, then take top 15 by totalCost
        const contractorList = Object.values(contractors)
            .filter(c => c.numProjects >= 5)
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, 15);

        return contractorList;
    }

    buildReportRows(contractorList) {
        const reportHeader = ['Rank', 'Contractor', 'Total Cost', 'NumProjects', 'AvgDelay', 'TotalSavings', 'ReliabilityIndex', 'RiskFlag'];

        const reportRows = contractorList.map((c, idx) => {
            const avgDelay = c.delays.length
                ? c.delays.reduce((s, v) => s + v, 0) / c.delays.length
                : 0;

            let reliabilityIndex = 0;
            if (c.totalCost > 0) {
                const delayFactor  = 1 - (avgDelay / 90);
                const savingsRatio = c.totalSavings / c.totalCost;
                reliabilityIndex   = delayFactor * savingsRatio * 100;
            }

            const riskFlag = reliabilityIndex < 50 ? 'High Risk' : 'Low Risk';

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

        return { reportHeader, reportRows };
    }
}