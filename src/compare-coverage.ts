import fs from 'fs'
import * as core from '@actions/core'

import {exit} from 'process'

type CoverageData = {
  Statements: number
  Branches: number
  Functions: number
  Lines: number
}

function readCoverage(filePath: string): CoverageData | null {
  if (!fs.existsSync(filePath)) {
    core.error(`File "${filePath}" doesn't exist`)
    return null
  }
  try {
    const cov = fs.readFileSync(filePath, 'utf-8')

    const Statements = Number(/Statements\s+:\s+(\d+(\.\d+)?)/.exec(cov)?.[1])
    const Branches = Number(/Branches\s+:\s+(\d+(\.\d+)?)/.exec(cov)?.[1])
    const Functions = Number(/Functions\s+:\s+(\d+(\.\d+)?)/.exec(cov)?.[1])
    const Lines = Number(/Lines\s+:\s+(\d+(\.\d+)?)/.exec(cov)?.[1])

    return {
      Statements,
      Branches,
      Functions,
      Lines
    }
  } catch (err) {
    return null
  }
}

function compareCoverageData(
  prev: CoverageData,
  cur: CoverageData
): CoverageData {
  const Statements = Number(
    (prev?.Statements ? cur.Statements - prev.Statements : 0)?.toFixed(2)
  )
  const Branches = Number(
    (prev?.Branches ? cur.Branches - prev.Branches : 0)?.toFixed(2)
  )
  const Functions = Number(
    (prev?.Functions ? cur.Functions - prev.Functions : 0)?.toFixed(2)
  )
  const Lines = Number((prev?.Lines ? cur.Lines - prev.Lines : 0)?.toFixed(2))
  return {
    Statements,
    Branches,
    Functions,
    Lines
  }
}

export function getCoverageComment({
  commitId,
  currentCoverageFile,
  previousCommitId,
  previousCoverageFile
}: {
  commitId: string
  currentCoverageFile: string
  previousCommitId?: string
  previousCoverageFile?: string
}): string {
  // Get coverage files to compare

  core.info(
    `Comparing new coverage from ${currentCoverageFile} to previous ${previousCoverageFile}...`
  )
  core.info(`Previous commit: ${previousCommitId}`)

  const prevCov = previousCoverageFile
    ? readCoverage(previousCoverageFile)
    : null
  const currentCov = readCoverage(currentCoverageFile)

  if (!currentCov) {
    core.debug('Couldnt obtain current coverage')
    core.setFailed('Could not get coverage')
    exit(0)
  }

  const trends =
    prevCov !== null ? compareCoverageData(prevCov, currentCov) : null

  const message = [
    `### Coverage trend:`,
    `_Commit ${commitId}${
      previousCommitId
        ? `( [compared](https://github.com/alvaromartmart/code-coverage-tracker/compare/${previousCommitId}..${commitId}) to ${previousCommitId} )`
        : ''
    }_`,
    ...(trends
      ? [
          `| - | Previous | Current | Trend |`,
          `| --- | --- | --- | --- |`,
          `| Statements | ${prevCov?.Statements}% | ${
            currentCov.Statements
          }% | ${
            trends.Statements >= 0
              ? trends.Statements === 0
                ? '-'
                : '✅'
              : '🔻'
          } ${trends.Statements}% |`,
          `| Branches | ${prevCov?.Branches}% | ${currentCov.Branches}% | ${
            trends.Branches >= 0 ? (trends.Branches === 0 ? '-' : '✅') : '🔻'
          } ${trends.Branches}% |`,
          `| Functions | ${prevCov?.Functions}% | ${currentCov.Functions}% | ${
            trends.Functions >= 0 ? (trends.Functions === 0 ? '-' : '✅') : '🔻'
          } ${trends.Functions}% |`,
          `| Lines | ${prevCov?.Lines}% | ${currentCov.Lines}% | ${
            trends.Lines >= 0 ? (trends.Lines === 0 ? '-' : '✅') : '🔻'
          } ${trends.Lines}% |\n`
        ]
      : [
          `| - | Previous | Current | Trend |`,
          `| --- | --- | --- | --- |`,
          `| Statements | ? | ${currentCov.Statements}% | ? |`,
          `| Branches | ? | ${currentCov.Branches}% | ? |`,
          `| Functions | ? | ${currentCov.Functions}% | ? |`,
          `| Lines | ? | ${currentCov.Lines}% | ? |\n`
        ])
  ].join('\n')

  core.debug(message)
  return message
}
