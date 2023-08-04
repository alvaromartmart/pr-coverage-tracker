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
function run() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const currentCoverageFile = core.getInput('coverage-path', {
                required: true
            });
            const previousCoverageFile = core.getInput('reference-coverage-path');
            const token = core.getInput('token', { required: true });
            const octokit = (0, github_1.getOctokit)(token);
            let sha;
            let branchName;
            if (github_1.context.eventName === 'pull_request') {
                const pr = yield octokit.rest.pulls.get({
                    pull_number: github_1.context.issue.number,
                    owner: github_1.context.issue.owner,
                    repo: github_1.context.issue.repo
                });
                // Restore previous coverage to compare with from cache
                const restoreKey = `${process.platform}-${github_1.context.eventName === 'pull_request'
                    ? pr.data.base.ref
                    : pr.data.head.ref}-prev-`;
                const previousCoverageRecoveredKey = yield cache.restoreCache([core.getInput('reference-coverage-path')], restoreKey, [restoreKey]);
                if (previousCoverageRecoveredKey) {
                    core.info(`Restoring previous coverage from cache key ${previousCoverageRecoveredKey}...`);
                }
                else {
                    core.warning(`Couldnt get previous coverage from cache key ${restoreKey}`);
                }
                sha = previousCoverageRecoveredKey
                    ? (_a = /prev-([^-]+)-.*$/.exec(previousCoverageRecoveredKey)) === null || _a === void 0 ? void 0 : _a[1]
                    : undefined;
                if (sha) {
                    core.info(`Reference coverage was calculated for commit ${sha}`);
                }
                branchName = pr.data.head.ref;
            }
            else {
                branchName = github_1.context.ref.replace(/^refs\/heads\//, '');
            }
            const comment = (0, compare_coverage_1.getCoverageComment)({
                commitId: github_1.context.sha,
                previousCommitId: sha,
                currentCoverageFile,
                previousCoverageFile
            });
            core.info(comment);
            fs.writeFileSync('comment.md', comment);
            // Cache coverage as reference
            yield (0, io_1.cp)(currentCoverageFile, previousCoverageFile, { force: true });
            yield cache.saveCache([previousCoverageFile], `${process.platform}-${branchName}-prev-${github_1.context.sha}`);
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
