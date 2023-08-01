"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCoverageComment = void 0;
const fs_1 = __importDefault(require("fs"));
const core = __importStar(require("@actions/core"));
const process_1 = require("process");
function readCoverage(filePath) {
    var _a, _b, _c, _d;
    if (!fs_1.default.existsSync(filePath)) {
        core.error(`File "${filePath}" doesn't exist`);
        return null;
    }
    try {
        const cov = fs_1.default.readFileSync(filePath, 'utf-8');
        const Statements = Number((_a = /Statements\s+:\s+(\d+(\.\d+)?)/.exec(cov)) === null || _a === void 0 ? void 0 : _a[1]);
        const Branches = Number((_b = /Branches\s+:\s+(\d+(\.\d+)?)/.exec(cov)) === null || _b === void 0 ? void 0 : _b[1]);
        const Functions = Number((_c = /Functions\s+:\s+(\d+(\.\d+)?)/.exec(cov)) === null || _c === void 0 ? void 0 : _c[1]);
        const Lines = Number((_d = /Lines\s+:\s+(\d+(\.\d+)?)/.exec(cov)) === null || _d === void 0 ? void 0 : _d[1]);
        return {
            Statements,
            Branches,
            Functions,
            Lines
        };
    }
    catch (err) {
        return null;
    }
}
function compareCoverageData(prev, cur) {
    var _a, _b, _c, _d;
    const Statements = Number((_a = ((prev === null || prev === void 0 ? void 0 : prev.Statements) ? cur.Statements - prev.Statements : 0)) === null || _a === void 0 ? void 0 : _a.toFixed(2));
    const Branches = Number((_b = ((prev === null || prev === void 0 ? void 0 : prev.Branches) ? cur.Branches - prev.Branches : 0)) === null || _b === void 0 ? void 0 : _b.toFixed(2));
    const Functions = Number((_c = ((prev === null || prev === void 0 ? void 0 : prev.Functions) ? cur.Functions - prev.Functions : 0)) === null || _c === void 0 ? void 0 : _c.toFixed(2));
    const Lines = Number((_d = ((prev === null || prev === void 0 ? void 0 : prev.Lines) ? cur.Lines - prev.Lines : 0)) === null || _d === void 0 ? void 0 : _d.toFixed(2));
    return {
        Statements,
        Branches,
        Functions,
        Lines
    };
}
function getCoverageComment({ commitId, currentCoverageFile, previousCommitId, previousCoverageFile }) {
    // Get coverage files to compare
    core.info(`Comparing new coverage from ${currentCoverageFile} to previous ${previousCoverageFile}...`);
    core.info(`Previous commit: ${previousCommitId}`);
    const prevCov = previousCoverageFile
        ? readCoverage(previousCoverageFile)
        : null;
    const currentCov = readCoverage(currentCoverageFile);
    if (!currentCov) {
        core.debug('Couldnt obtain current coverage');
        core.setFailed('Could not get coverage');
        (0, process_1.exit)(0);
    }
    const trends = prevCov !== null ? compareCoverageData(prevCov, currentCov) : null;
    const message = [
        `### Coverage trend:`,
        `_Commit ${commitId}${previousCommitId
            ? `( [compared](https://github.com/alvaromartmart/code-coverage-tracker/compare/${previousCommitId}..${commitId}) to ${previousCommitId} )`
            : ''}_`,
        ...(trends
            ? [
                `| - | Previous | Current | Trend |`,
                `| --- | --- | --- | --- |`,
                `| Statements | ${prevCov === null || prevCov === void 0 ? void 0 : prevCov.Statements}% | ${currentCov.Statements}% | ${trends.Statements >= 0
                    ? trends.Statements === 0
                        ? '-'
                        : '✅'
                    : '🔻'} ${trends.Statements}% |`,
                `| Branches | ${prevCov === null || prevCov === void 0 ? void 0 : prevCov.Branches}% | ${currentCov.Branches}% | ${trends.Branches >= 0 ? (trends.Branches === 0 ? '-' : '✅') : '🔻'} ${trends.Branches}% |`,
                `| Functions | ${prevCov === null || prevCov === void 0 ? void 0 : prevCov.Functions}% | ${currentCov.Functions}% | ${trends.Functions >= 0 ? (trends.Functions === 0 ? '-' : '✅') : '🔻'} ${trends.Functions}% |`,
                `| Lines | ${prevCov === null || prevCov === void 0 ? void 0 : prevCov.Lines}% | ${currentCov.Lines}% | ${trends.Lines >= 0 ? (trends.Lines === 0 ? '-' : '✅') : '🔻'} ${trends.Lines}% |\n`
            ]
            : [
                `| - | Previous | Current | Trend |`,
                `| --- | --- | --- | --- |`,
                `| Statements | ? | ${currentCov.Statements}% | ? |`,
                `| Branches | ? | ${currentCov.Branches}% | ? |`,
                `| Functions | ? | ${currentCov.Functions}% | ? |`,
                `| Lines | ? | ${currentCov.Lines}% | ? |\n`
            ])
    ].join('\n');
    core.debug(message);
    return message;
}
exports.getCoverageComment = getCoverageComment;
