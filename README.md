# pr-coverage-tracker

This is forked from https://github.com/alvaromartmart/pr-coverage-tracker with the following improvements:

* **Smart cache management**: Before saving coverage data to cache, the action checks if the key already exists. If so, it deletes the old entry first and recreates it, avoiding cache save failures.
* **Cross-event commit resolution**: Resolves the previous commit ID regardless of whether it's a pull-request event or a direct branch push event.
* **Check mode (cache-hit probing)**: A new `mode` input (`check` / `compare`) allows you to probe the cache without running a full comparison. When `mode` is set to `check`, the action exits early after probing the cache and outputs the `cache-hit` result. This is useful for workflows that need to conditionally run steps based on whether previous coverage data is cached (e.g., skip coverage comparison if no baseline exists yet).
* **Coverage trend output improvements**: The trend table now uses "Base" and "Current" column headers, and URLs in the trend output are validated before rendering.

---

A Github Action to compare and comment PRs with code coverage trends.

It works by parsing `text-summary.txt` produced after a successful test run, and when a reference coverage is available, comparing it to previous values and showing coverage trends.

The previous coverage is restored from GHA cache.

* When the action runs on any branch, the output `text-summary.txt` is cached using a key `{os}-{branchName}-prev-{commitSha}`
* When the action runs on a PR, it tries to recover from the cache the latest `text-summary.txt` corresponding to the base branch, e.g. `{os}-{baseBranchName}-prev-{commitSha}`
* It compares the values and produces an output similar to the following example:

> ### Coverage trend:
> _Commit 8098981112ac04acef32425b13852e8f69f0f1c4_
> | - | Base | Current | Trend |
> | --- | --- | --- | --- |
> | Statements | 54% | 90% | :white_check_mark: 36% |
> | Branches | 42% | 10% | :small_red_triangle_down: -32% |
> | Functions | 48% | 48% | - | 
> | Lines | 54% | 54% | - |

## Usage

### Basic usage

```yml
      - name: Compare coverage
        uses: <your-fork>/pr-coverage-tracker@v1
        id: coverage
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          coverage-path: coverage/text-summary.txt
```

### Check mode (probe cache only)

Use `mode: check` to detect whether a cached baseline exists before running the full comparison. This is helpful when you want to skip comparison on first-time builds.

```yml
      - name: Probe coverage cache
        uses: <your-fork>/pr-coverage-tracker@v1
        id: coverage-check
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          coverage-path: coverage/text-summary.txt
          mode: check

      - name: Compare coverage
        if: steps.coverage-check.outputs.cache-hit == 'true'
        uses: <your-fork>/pr-coverage-tracker@v1
        id: coverage
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          coverage-path: coverage/text-summary.txt
```

### Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `token` | `GITHUB_TOKEN` or a `repo` scoped [PAT](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token). | `GITHUB_TOKEN` |
| `coverage-path` | Path to the `text-summary.txt` containing the coverage output | |
| `reference-coverage-path` | Path to the reference `text-summary.txt` copy. The action will copy the file specified by `coverage-path` to `reference-coverage-path` at the end and cache it so it can be recovered when the action runs on a PR to compare with previous coverage | `__prev-text-summary.txt` |
| `mode` | `check` only probes the cache and outputs `cache-hit`; `compare` runs the full comparison | `compare` |

#### Outputs

* `comment`: raw text value (markdown-formatted) with the output summary
* `comment-file`: path to markdown file containing the output summary
* `compared`: `true` if the action was able to compare coverage with the base branch
* `has-changed`: `true` if a comparison with base branch was performed and there are changes in coverage
* `cache-hit`: `true` if previous coverage was found in cache, `false` otherwise
 
These can be used in later steps.
Note that in order to read the step outputs the action step must have an id.

Example: adding a comment to the PR with the summary

```yml
      - name: Compare coverage
        uses: <your-fork>/pr-coverage-tracker@v1
        id: coverage
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          coverage-path: coverage/text-summary.txt
      - name: Write comment
        if: (steps.coverage.outputs.compared == 'true') && (steps.coverage.outputs.has-changed == 'true') && github.event_name == 'pull_request'
        uses: peter-evans/create-or-update-comment@v3.0.1
        with:
          issue-number: ${{ github.event.number }}
          body-path: ${{ steps.coverage.outputs.comment-file }}
```

## License

[MIT](LICENSE)