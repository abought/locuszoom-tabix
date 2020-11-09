#!/usr/bin/env sh

# Deploy script based on: https://cli.vuejs.org/guide/deployment.html

# abort on errors
set -e

# build
npm run build

# navigate into the build output directory
cd dist

# if you are deploying to a custom domain
# echo 'www.example.com' > CNAME

git init
git add -A
git commit -m 'Deploy newest version'

# if you are deploying to https://<USERNAME>.github.io/<REPO>
git push -f https://github.com/statgen/localzoom.git master:gh-pages

cd -
