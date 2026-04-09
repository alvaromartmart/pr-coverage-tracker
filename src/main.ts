import * as core from '@actions/core'
import {context, getOctokit} from '@actions/github'
import * as cache from '@actions/cache'
import {getCoverageComment} from './compare-coverage'
import {mv} from '@actions/io'
import * as fs from 'fs'

type OctokitClient = ReturnType<typeof getOctokit>
type ActionsCacheEntry = {id: number; key: string}
const SHA_FROM_KEY_RE = /prev-([0-9a-fA-F]+)(?:-|$)/

async function tryRestorePreviousCoverage(
  restoreKey: string,
  previousCoverageFile: string
): Promise<{sha?: string; recoveredKey?: string}> {
  const recoveredKey = await cache.restoreCache(
    [previousCoverageFile],
    restoreKey,
    [restoreKey]
  )
  if (recoveredKey) {
    core.info(`Restoring previous coverage from cache key ${recoveredKey}...`)
    const m = SHA_FROM_KEY_RE.exec(recoveredKey)
    if (m && m[1]) {
      core.info(`Parsed previous commit id ${m[1]} from cache key`)
      return {sha: m[1], recoveredKey}
    } else {
      core.warning(
        `Could not parse commit id from cache key '${recoveredKey}' with pattern ${SHA_FROM_KEY_RE}`
      )
      return {sha: undefined, recoveredKey}
    }
  } else {
    core.warning(`Couldnt get previous coverage from cache key ${restoreKey}`)
    return {sha: undefined, recoveredKey: undefined}
  }
}

async function getParentCommitSha(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  refSha: string
): Promise<string | undefined> {
  try {
    const commitResp = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: refSha
    })
    const parentSha = commitResp.data.parents?.[0]?.sha
    if (parentSha) {
      core.info(`Using parent commit ${parentSha} as previousCommitId`)
    } else {
      core.warning('No parent commit found for current commit')
    }
    return parentSha
  } catch (e) {
    core.warning(
      `Failed to fetch parent commit via API: ${(e as Error).message}`
    )
    return undefined
  }
}

async function run(): Promise<void> {
  try {
    const currentCoverageFile: string = core.getInput('coverage-path', {
      required: true
    })
    // Resolve reference coverage path; allow empty input -> use default filename
    const previousCoverageInput: string = core.getInput(
      'reference-coverage-path'
    )
    const previousCoverageFile: string =
      previousCoverageInput && previousCoverageInput.trim().length > 0
        ? previousCoverageInput.trim()
        : '__prev-text-summary.txt'
    if (!previousCoverageInput || previousCoverageInput.trim().length === 0) {
      core.info(
        "No 'reference-coverage-path' provided; defaulting to '__prev-text-summary.txt'"
      )
    }

    const token = core.getInput('token', {required: true})
    const mode = core.getInput('mode') || 'compare'
    if (mode !== 'check' && mode !== 'compare') {
      core.warning(`Unrecognized mode '${mode}', defaulting to 'compare'`)
    }

    const octokit = getOctokit(token)

    let sha: string | undefined
    let branchName: string
    let baselineBranch: string

    if (context.eventName === 'pull_request') {
      const pr = await octokit.rest.pulls.get({
        pull_number: context.issue.number,
        owner: context.issue.owner,
        repo: context.issue.repo
      })
      branchName = pr.data.head.ref
      baselineBranch = pr.data.base.ref
    } else {
      branchName = context.ref.replace(/^refs\/heads\//, '')
      baselineBranch = branchName
    }

    // Restore previous coverage for baseline branch
    const restoreKey = `${process.platform}-${baselineBranch}-prev-`
    const {sha: restoredSha} = await tryRestorePreviousCoverage(
      restoreKey,
      previousCoverageFile
    )
    sha = restoredSha

    const cacheHit = restoredSha !== undefined
    core.setOutput('cache-hit', cacheHit)
    core.info(`Cache probe result: cache-hit=${cacheHit}`)

    if (mode === 'check') {
      core.info('Check mode: exiting after cache probe')
      return
    }

    // For non-PR events, if cache not found, fallback to previous commit via API
    if (context.eventName !== 'pull_request' && !sha) {
      sha = await getParentCommitSha(
        octokit,
        context.repo.owner,
        context.repo.repo,
        context.sha
      )
    }

    const comment = getCoverageComment({
      commitId: context.sha,
      currentCoverageFile,
      previousCommitId: sha,
      previousCoverageFile
    })

    core.info(comment)

    fs.writeFileSync('comment.md', comment)

    // Cache coverage as reference
    await mv(currentCoverageFile, previousCoverageFile, {force: true})
    // Check if cache key already exists; list caches and delete matching entry to avoid save failure
    const targetKey = `${process.platform}-${branchName}-prev-${context.sha}`
    try {
      const listResp = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/caches',
        {
          owner: context.repo.owner,
          repo: context.repo.repo,
          per_page: 100
        }
      )
      const data = listResp.data as {
        actions_caches?: ActionsCacheEntry[]
        caches?: ActionsCacheEntry[]
      }
      const caches: ActionsCacheEntry[] =
        data.actions_caches ?? data.caches ?? []
      const existing = caches.find(c => c.key === targetKey)
      if (existing) {
        core.info(
          `Cache key ${targetKey} already exists (id=${existing.id}), deleting it before saving new one.`
        )
        await octokit.request(
          'DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}',
          {
            owner: context.repo.owner,
            repo: context.repo.repo,
            cache_id: existing.id
          }
        )
      } else {
        core.info(
          `Cache key ${targetKey} does not exist yet; will create new cache.`
        )
      }
    } catch (e) {
      core.warning(
        `Could not verify existing cache keys: ${(e as Error).message}`
      )
    }
    await cache.saveCache([previousCoverageFile], targetKey)

    core.setOutput('comment-file', 'comment.md')
    core.setOutput('comment', comment)
  } catch (error) {
    core.error('Something went wrong')
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
