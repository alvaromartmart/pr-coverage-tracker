# pr-coverage-tracker

A Github Action to compare and comment PRs with code coverage trends.

It works by parsing `text-summary.txt` produced after a successfull test run, and when a reference coverage is available, comparing it to previous values and showing coverage trends.

The previous coverage is restored from GHA cache.

* When the action runs on any branch, the output `text-summary-txt` is cached using a key `{os}-{branchName}-prev-{commitSha}`
* Whent the action runs on a PR, it tries to recover from the cache the latest `text-summary-txt` corresponding to the base branch, e.g. `{os}-{baseBranchName}-prev-{commitSha}`
* It compares the values and produces an output similar to the following example:

> ### Coverage trend:
> _Commit 8098981112ac04acef32425b13852e8f69f0f1c4_
> | - | Previous | Current | Trend |
> | --- | --- | --- | --- |
> | Statements | 54% | 90% | ✅ 36% |
> | Branches | 42% | 10% | 🔻 -32% |
> | Functions | 48% | 48% | - | 
> | Lines | 54% | 54% | - |

## Usage

### Find the first comment containing the specified string

```yml
      - name: Compare coverage
        uses: alvaromartmart/pr-coverage-tracker@v1
        id: coverage
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

```

### Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `token` | `GITHUB_TOKEN` or a `repo` scoped [PAT](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token). | `GITHUB_TOKEN` |
| `coverage-path` | Path to the `text-summary.txt` containing the coverage output |
| `reference-coverage-path` | Path to the reference `text-summary-txt` copy. The action will copy the file specified by `coverage-path` to `reference-coverage-path` at the end and cache it so it can be recovered when the action runs on a PR to compare with previous coverage | `__prev-text-summary.txt` |

#### Outputs

* `comment`: raw text value (markdown-formatted) with the output summary
* `comment-file`: path to markdown file containing the output summary
 
These can be used in later steps.
Note that in order to read the step outputs the action step must have an id.

Example: adding a comment to the PR with the summary

```yml
      - name: Compare coverage
        uses: alvaromartmart/pr-coverage-tracker@v1
        id: coverage
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      - name: Find Comment
        uses: peter-evans/create-or-update-comment@v3.0.1
        if: github.event_name == 'pull_request'
        with:
          issue-number: ${{ github.event.number }}
          body-path: ${{ steps.coverage.outputs.comment-file }}
```

## License

[MIT](LICENSE)