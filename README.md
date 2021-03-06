# LocalZoom

This is a demonstration of loading GWAS results via the web browser, fetching only the data 
required for that region. It works with Tabixed GWAS data files in a variety of formats.

A live [demonstration](https://statgen.github.io/localzoom/) is available. 


## Getting help
User and technical help is available via the [LocusZoom mailing list](http://groups.google.com/group/locuszoom).
Please specify that you are asking about "*LocalZoom*".

## Developer instructions
### Project setup
This project uses npm for dependency management. Typically, the build commands work with all actively supported NodeJS LTS releases.

```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Building for production
The production build is a minified, concatenated bundle suitable for distribution on a server.

In order to use the Sentry error logging and Google Analytics feature, you will need to create a 
file named *.env.production.local* (ignored by git) with the following contents 
(both values are optional if you don't want to use these features): 
```dotenv
VUE_APP_SENTRY_DSN=https://dsn.example
VUE_APP_GOOGLE_ANALYTICS_KEY=UA-YOURKEY-1
```

Then build the assets to the `dist/` folder.
```bash
npm run build
```

If you are distributing this to our official GitHub pages location, there is a helper command that 
will update (and push) the `gh-pages` branch:
```bash
npm run deploy
```

When ready, verify the built app and push to production.

### Lints and fixes files
This project uses a style and syntax checker for code quality. The following command can help to 
identify (and automatically fix) common issues.
```
npm run lint
```

### Run unit tests
```
npm run test:unit
```
