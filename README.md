# Workflow for my projects

This repository holds most reusable workflow for my own projects.

## Things I learnt while writing good GitHub workflow

- One step, one command
   - Do not put many commands into a single step, it's not easy to know which command failed the whole step
   - Exit code are checked only on the last command
      - To quit sooner, `jq -r 'if .not.great then halt_error(1) end' && true || exit 1`
   - Smaller steps limit exposure of token/env
- Programmatically build matrix using [`fromJSON`](https://docs.github.com/en/actions/learn-github-actions/expressions#example-returning-a-json-object)
   - `echo matrix=jq -cnr '["package-1", "package-2"]' >> $GITHUB_OUTPUT`
   - `matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}`
- When should jobs be split
   - Job can be rerun
   - When you want to rerun the job, it is the place where you want to split jobs
   - One job, one thing to publish/deploy
   - Limiting permissions
- Increase atomicity by following build-first-deploy-later model
   - Build everything and upload their artifacts first
   - Then, converge all jobs (`needs: [build-package, build-pages]`) into an approval job
   - Then, do all deployment after the approval job (`needs: approval`)
   - Benefits: don't deploy when some builds failed
   - Benefits: rerun failed builds/deployments
- If you want to work with commits/tags
   - `actions/checkout@v3` with `fetch-depth: 0`
- Reduce CD flakiness, do not run tests at continuous deployment
- If inputs can be derived from repo
   - Build a prepare step and upload the "jobs" or "instructions" file
   - Other jobs will download the "jobs" file and use it as source of truth
- Inputs vs. environment variables
   - Inputs are auto-expanded for readability, preferred if it don't introduce too much complexity
- `npm version 1.2.3-abc.0123` will change version to `1.2.3-abc.123`, leading zeroes in prerelease tags may be removed
   - `1.2.3-beta.00123` -> `1.2.3-beta.123` (segmented part are all numeric)
   - `1.2.3-beta-00123` -> `1.2.3-beta-00123` (hyphens do not segment)
   - `1.2.3-beta.00123abc` -> `1.2.3-beta.00123abc` (segmented part are not all numeric)
   - After `npm version 1.2.3-xyz`, read it again and use that version from that point of time
   - `npx semver` don't remove leading zeroes in prerelease tags
- Semantic versioning will sort prerelease tags alphabetically and ignore build identifiers
   - `1.2.3-beta.1` > `1.2.3-beta.0`
   - `1.2.3-beta+1` ~= `1.2.3-beta+0`
   - For this reason, it is recommended to add `%Y%m%d-%H%M%S` to the prerelease tag
- Pack as tarball before publish
   - Upload tarball to artifacts as "evidence"
   - Publish in another job without checkout
   - Very clean and definitive publish

## Snippets

### Checks if a package exists

```yml
- id: package-existence
  name: Check if package already present
  run: |
    EXIST=`npm view ${{ steps.prepare.outputs.package-id }} --json 2>/dev/null | jq -r 'if .error then if .error.code == "E404" then false else halt_error(1) end else true end'` && true || exit 1

    echo exist=$EXIST >> $GITHUB_OUTPUT
```

### Turns a GitHub Pages package into an artifact for `actions/upload-pages-artifact@v2`

```yml
build-pages:
  name: 'Build: GitHub Pages'
  needs:
    - build
  runs-on: ubuntu-latest
  steps:
    - name: Download packages
      uses: actions/download-artifact@v3
      with:
        name: packages
    - name: Extract pages package
      run: |
        mkdir ./_site/
        tar --extract --verbose --file=`ls -1 pages-[0-9]*.tgz` --strip-component=2 --directory=./_site/ package/public
        ls -la ./_site/
    - name: Upload pages artifact
      uses: actions/upload-pages-artifact@v2
```

### Get latest commitish of current folder

This will get the latest commitish of everything under the current folder. It is useful to know if anything changed under this folder.

Set `actions/checkout@v3` with `fetch-depth: 0` to fetch all commits.

```sh
COMMITTER_DATE=`git log --date=format:%Y%m%d.%H%M%S --pretty=format:'%cd' -1 ./`
LONG_COMMITISH=`git log --pretty=format:'%H' -1 ./$i/`
SHORT_COMMITISH=`git log --pretty=format:'%h' -1 ./$i/`
```

To bump prerelease tag:

```sh
VERSION=`npx semver --increment prerelease -n false --preid $BRANCH.$COMMITTER_DATE.$SHORT_COMMITISH`
```

There is a bug in `npm@9.5.1` or `semver@7.5.4` that, after running `npm version`, the next run of `semver -n false` will still append `.0` to the prerelease tag.

```sh
npm version 1.2.3-alpha
npx semver --increment -n false --preid beta # will produce "1.2.3-beta.0"
```
