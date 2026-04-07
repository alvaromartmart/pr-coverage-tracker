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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
const cache = __importStar(require("@actions/cache"));
const compare_coverage_1 = require("./compare-coverage");
const io_1 = require("@actions/io");
const fs = __importStar(require("fs"));
const SHA_FROM_KEY_RE = /prev-([0-9a-fA-F]+)(?:-|$)/;
function tryRestorePreviousCoverage(restoreKey, previousCoverageFile) {
    return __awaiter(this, void 0, void 0, function* () {
        const recoveredKey = yield cache.restoreCache([previousCoverageFile], restoreKey, [restoreKey]);
        if (recoveredKey) {
            core.info(`Restoring previous coverage from cache key ${recoveredKey}...`);
            const m = SHA_FROM_KEY_RE.exec(recoveredKey);
            if (m && m[1]) {
                core.info(`Parsed previous commit id ${m[1]} from cache key`);
                return { sha: m[1], recoveredKey };
            }
            else {
                core.warning(`Could not parse commit id from cache key '${recoveredKey}' with pattern ${SHA_FROM_KEY_RE}`);
                return { sha: undefined, recoveredKey };
            }
        }
        else {
            core.warning(`Couldnt get previous coverage from cache key ${restoreKey}`);
            return { sha: undefined, recoveredKey: undefined };
        }
    });
}
function getParentCommitSha(octokit, owner, repo, refSha) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const commitResp = yield octokit.rest.repos.getCommit({
                owner,
                repo,
                ref: refSha
            });
            const parentSha = (_b = (_a = commitResp.data.parents) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.sha;
            if (parentSha) {
                core.info(`Using parent commit ${parentSha} as previousCommitId`);
            }
            else {
                core.warning('No parent commit found for current commit');
            }
            return parentSha;
        }
        catch (e) {
            core.warning(`Failed to fetch parent commit via API: ${e.message}`);
            return undefined;
        }
    });
}
function run() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const currentCoverageFile = core.getInput('coverage-path', {
                required: true
            });
            // Resolve reference coverage path; allow empty input -> use default filename
            const previousCoverageInput = core.getInput('reference-coverage-path');
            const previousCoverageFile = previousCoverageInput && previousCoverageInput.trim().length > 0
                ? previousCoverageInput.trim()
                : '__prev-text-summary.txt';
            if (!previousCoverageInput || previousCoverageInput.trim().length === 0) {
                core.info("No 'reference-coverage-path' provided; defaulting to '__prev-text-summary.txt'");
            }
            const token = core.getInput('token', { required: true });
            const mode = core.getInput('mode') || 'compare';
            if (mode !== 'check' && mode !== 'compare') {
                core.warning(`Unrecognized mode '${mode}', defaulting to 'compare'`);
            }
            const octokit = (0, github_1.getOctokit)(token);
            let sha;
            let branchName;
            let baselineBranch;
            if (github_1.context.eventName === 'pull_request') {
                const pr = yield octokit.rest.pulls.get({
                    pull_number: github_1.context.issue.number,
                    owner: github_1.context.issue.owner,
                    repo: github_1.context.issue.repo
                });
                branchName = pr.data.head.ref;
                baselineBranch = pr.data.base.ref;
            }
            else {
                branchName = github_1.context.ref.replace(/^refs\/heads\//, '');
                baselineBranch = branchName;
            }
            // Restore previous coverage for baseline branch
            const restoreKey = `${process.platform}-${baselineBranch}-prev-`;
            const { sha: restoredSha } = yield tryRestorePreviousCoverage(restoreKey, previousCoverageFile);
            sha = restoredSha;
            const cacheHit = restoredSha !== undefined;
            core.setOutput('cache-hit', cacheHit);
            core.info(`Cache probe result: cache-hit=${cacheHit}`);
            if (mode === 'check') {
                core.info('Check mode: exiting after cache probe');
                return;
            }
            // For non-PR events, if cache not found, fallback to previous commit via API
            if (github_1.context.eventName !== 'pull_request' && !sha) {
                sha = yield getParentCommitSha(octokit, github_1.context.repo.owner, github_1.context.repo.repo, github_1.context.sha);
            }
            const comment = (0, compare_coverage_1.getCoverageComment)({
                commitId: github_1.context.sha,
                currentCoverageFile,
                previousCommitId: sha,
                previousCoverageFile
            });
            core.info(comment);
            fs.writeFileSync('comment.md', comment);
            // Cache coverage as reference
            yield (0, io_1.mv)(currentCoverageFile, previousCoverageFile, { force: true });
            // Check if cache key already exists; list caches and delete matching entry to avoid save failure
            const targetKey = `${process.platform}-${branchName}-prev-${github_1.context.sha}`;
            try {
                const listResp = yield octokit.request('GET /repos/{owner}/{repo}/actions/caches', {
                    owner: github_1.context.repo.owner,
                    repo: github_1.context.repo.repo,
                    per_page: 100
                });
                const data = listResp.data;
                const caches = (_b = (_a = data.actions_caches) !== null && _a !== void 0 ? _a : data.caches) !== null && _b !== void 0 ? _b : [];
                const existing = caches.find(c => c.key === targetKey);
                if (existing) {
                    core.info(`Cache key ${targetKey} already exists (id=${existing.id}), deleting it before saving new one.`);
                    yield octokit.request('DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}', {
                        owner: github_1.context.repo.owner,
                        repo: github_1.context.repo.repo,
                        cache_id: existing.id
                    });
                }
                else {
                    core.info(`Cache key ${targetKey} does not exist yet; will create new cache.`);
                }
            }
            catch (e) {
                core.warning(`Could not verify existing cache keys: ${e.message}`);
            }
            yield cache.saveCache([previousCoverageFile], targetKey);
            core.setOutput('comment-file', 'comment.md');
            core.setOutput('comment', comment);
        }
        catch (error) {
            core.error('Something went wrong');
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
run();
