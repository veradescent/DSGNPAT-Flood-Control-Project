import { stringify } from 'csv-stringify/sync';
import fs from 'node:fs';
import path from 'node:path';
import { printTable } from '../utils/printTable.js';

export class ReportGenerator {

    constructor(cleanedFilteredRows) {
        this.cleanedFilteredRows = cleanedFilteredRows;
    }

    async generate() {
        if (!this.guardCheck()) return;

        const { header, records } = this.getHeaderAndRecords();
        const indices = this.retrieveIndices(header);

        if (!this.validateIndices(indices)) return;

        const data = this.aggregateData(records, indices);
        const { reportHeader, reportRows } = this.buildReportRows(data);
        const sorted = this.sortRows(reportRows);

        this.printReport(reportHeader, sorted);
        await this.exportCSV(reportHeader, sorted);
    }

    guardCheck() {
        if (!this.cleanedFilteredRows || this.cleanedFilteredRows.length < 2) {
            console.log(`No cleaned dataset available for ${this.getReportName()}. Please load and filter the file first.`);
            return false;
        }
        return true;
    }

    getHeaderAndRecords() {
        const header = this.cleanedFilteredRows[0] || [];
        const records = this.cleanedFilteredRows.slice(1);
        return { header, records };
    }

    parseNumber(v) {
        if (v === undefined || v === null) return 0;
        const s = String(v).trim();
        const cleaned = s.replace(/[^0-9.\-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
    }

    calculateDelayDays(startDateStr, actualCompletionDateStr) {
        try {
            const startDate = new Date(startDateStr);
            const actualCompletionDate = new Date(actualCompletionDateStr);
            if (isNaN(startDate) || isNaN(actualCompletionDate)) return 0;
            const delayMs = actualCompletionDate - startDate;
            return Math.floor(delayMs / (1000 * 60 * 60 * 24));
        } catch (e) {
            return 0;
        }
    }

    printReport(reportHeader, reportRows) {
        console.log(`\n${this.getReportName()}`);
        console.log(`\n${this.getReportTitle()}`);
        console.log(this.getReportSubtitle());
        printTable(reportHeader, reportRows);
    }

    async exportCSV(reportHeader, reportRows) {
        const outPath = path.resolve(this.getOutputFilename());
        const output = stringify([reportHeader, ...reportRows]);
        await fs.promises.writeFile(outPath, output, 'utf8');
        console.log(`\n(Full table exported to ${this.getOutputFilename()})`);
    }

    getReportName() {
        throw new Error(`${this.constructor.name} must implement getReportName()`);
    }

    getReportTitle() {
        throw new Error(`${this.constructor.name} must implement getReportTitle()`);
    }

    
    getReportSubtitle() {
        throw new Error(`${this.constructor.name} must implement getReportSubtitle()`);
    }

    getOutputFilename() {
        throw new Error(`${this.constructor.name} must implement getOutputFilename()`);
    }

    retrieveIndices(header) {
        throw new Error(`${this.constructor.name} must implement retrieveIndices()`);
    }

    validateIndices(indices) {
        throw new Error(`${this.constructor.name} must implement validateIndices()`);
    }

    aggregateData(records, indices) {
        throw new Error(`${this.constructor.name} must implement aggregateData()`);
    }

    buildReportRows(data) {
        throw new Error(`${this.constructor.name} must implement buildReportRows()`);
    }

    sortRows(rows) {
        return rows; // Default: no-op; subclasses override as needed
    }
}
