# Workflow for my projects

This repository holds most reusable workflow for my own projects.

## Things I learnt while writing good GitHub workflow

- One step, one command
   - Do not put many commands into a single step, it's not easy to know which command failed the whole step
   - Exit code are checked only on the last command
      - To bailout, `jq -r 'if .not.great then halt_error(1) end' && true || exit 1`
   - Smaller steps limit exposure of token/env
- Programmatically build [job matrix](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs) using [`fromJSON`](https://docs.github.com/en/actions/learn-github-actions/expressions#example-returning-a-json-object)
   - `echo matrix=jq -cnr '["package-1", "package-2"]' >> $GITHUB_OUTPUT`
   - `matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}`
- When should jobs be split
   - Job can be rerun
   - When you want to rerun the job, it is the place where you want to split jobs
   - One job, one thing to publish/deploy
   - Limiting permissions
- Always think about job rerunnability
   - Running `npm publish` twice will fail, should check if the package exists
- Increase atomicity by following build-first-deploy-later model
   - Build everything and upload their artifacts first
   - Then, converge all jobs (`needs: [build-package, build-pages]`) into an approval job
   - Then, do all deployment after the approval job (`needs: approval`)
   - Benefits: don't deploy when some builds failed
   - Benefits: rerun failed builds/deployments
- If you want to work with commits/tags
   - `actions/checkout@v3` with `fetch-depth: 0`
- Eliminate CD workflow flakiness
   - Continuous deployment workflow is unlikely to be monitored
   - Do not run tests during continuous deployment
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
   - If prerelease version is not committed to repo, it is recommended to add `main.%Y%m%d-%H%M%S.commitish` to the prerelease tag
- Pack as tarball before publish
   - Upload tarball to artifacts as "evidence"
   - Publish in another job without checkout
   - Very clean and definitive publish
- Don't overwrite release asset
   - `gh release upload --clobber` is nice for job rerun, but it will wipe out the upload time so no one know when it is being updated
- Consider how workflow run when forked, they will run with no settings/secrets

## Snippets

### Checks if a package exists

The outputs of the step will return `"true"` or `"false"`, and bailout if network or credentials error.

```yml
- id: package-existence
  name: Check if package already present
  run: |
    EXIST=`npm view my-package@1.2.3 --json 2>/dev/null | jq -r 'if .error then if .error.code == "E404" then false else halt_error(1) end else true end'` && true || exit 1

    echo exist=$EXIST >> $GITHUB_OUTPUT
```

In contrast.

```sh
echo abc=`jq -nr 'halt_error(1)'` # always return 0
```

### Turns a GitHub Pages package into an artifact for `actions/upload-pages-artifact@v2`

Build the `pages` package as part of `npm run build --workspaces`, then extract the tarball to use with `actions/upload-pages-artifact@v2` with all default settings.

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
COMMITTER_DATE=`git log --date=format:%Y%m%d-%H%M%S --pretty=format:'%cd' -1 ./`
LONG_COMMITISH=`git log --pretty=format:'%H' -1 ./$i/`
SHORT_COMMITISH=`git log --pretty=format:'%h' -1 ./$i/`
```

To bump prerelease tag:

```sh
BRANCH=`git branch --show-current` # main
VERSION_SUFFIX=`git log --date=format:%Y%m%d-%H%M%S --pretty=format:'%cd.%h' -1 ./` # 20230816-084809.a1b2c3
VERSION=`npx semver --increment prerelease -n false --preid $BRANCH.$VERSION_SUFFIX` # 0.0.0-main.20230816-084809.a1b2c3
```

There is a bug in `npm@9.5.1` or `semver@7.5.4`. After running `npm version`, the next run of `semver -n false` will still append `.0` to the prerelease tag.

```sh
npm version 1.2.3-alpha
npx semver --increment -n false --preid beta # will produce "1.2.3-beta.0"
```
