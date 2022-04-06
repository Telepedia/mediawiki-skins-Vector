/* eslint-disable no-console */
// @ts-nocheck
const fs = require( 'fs' );
const fetch = require( 'node-fetch' );
const path = require( 'path' );
const pa11y = require( 'pa11y' );

const htmlReporter = require( path.resolve( __dirname, './reporter/reporter.js' ) );
const config = require( path.resolve( __dirname, 'a11y.config.js' ) );

/**
 *  Delete and recreate the report directory
 */
function resetReportDir() {
	// Delete and create report directory
	fs.rmdirSync( config.reportDir, { recursive: true } );
	fs.mkdirSync( config.reportDir, { recursive: true } );
}

/**
 *  Log test results to Graphite
 *
 * @param {string} namespace
 * @param {string} name
 * @param {number} count
 * @return {Promise<any>}
 */
function sendMetrics( namespace, name, count ) {
	const metricPrefix = 'MediaWiki.a11y';
	const url = `${process.env.BEACON_URL}${metricPrefix}.${namespace}.${name}=${count}c`;
	return fetch( url );
}

/**
 *  Run pa11y on tests specified by the config.
 *
 * @param {Object} opts
 */
async function runTests( opts ) {
	try {
		if ( !config.env[ opts.env ] ) {
			throw new Error( `Invalid env value: '${opts.env}'` );
		}

		if ( opts.env !== 'ci' && opts.logResults ) {
			throw new Error( "Results can only be logged with '--env ci'" );
		}

		const tests = config.tests( opts.env );
		const allTestsHaveNames = tests.filter( ( test ) => test.name ).length === tests.length;
		if ( !allTestsHaveNames ) {
			throw new Error( 'Config missing test name' );
		}

		resetReportDir();

		const testPromises = tests.map( ( test ) => {
			const { url, name, ...testOptions } = test;
			const options = { ...config.defaults, ...testOptions };
			// Automatically enable screen capture for every test;
			options.screenCapture = `${config.reportDir}/${name}.png`;

			return pa11y( url, options ).then( ( testResult ) => {
				testResult.name = name;
				return testResult;
			} );
		} );

		// Run tests against multiple URLs
		const results = await Promise.all( testPromises ); // eslint-disable-line
		results.forEach( async ( testResult ) => {
			const name = testResult.name;
			const errorNum = testResult.issues.filter( ( issue ) => issue.type === 'error' ).length;
			const warningNum = testResult.issues.filter( ( issue ) => issue.type === 'warning' ).length;
			const noticeNum = testResult.issues.filter( ( issue ) => issue.type === 'notice' ).length;

			// Log results summary to console
			if ( !opts.silent ) {
				console.log( `'${name}'- ${errorNum} errors, ${warningNum} warnings, ${noticeNum} notices` );
			}

			// Send data to Graphite
			// BEACON_URL is only defined in CI env
			if ( opts.env === 'ci' && opts.logResults && process.env.BEACON_URL ) {
				if ( !config.namespace ) {
					throw new Error( 'Config missing namespace' );
				}
				await sendMetrics( config.namespace, testResult.name, errorNum )
					.then( ( response ) => {
						if ( response.ok ) {
							console.log( `'${name}' results logged successfully` );
						} else {
							console.error( `Failed to log '${name}' results` );
						}
					} );
			}

			// Save in html report
			const html = await htmlReporter.results( testResult );
			fs.promises.writeFile( `${config.reportDir}/report-${name}.html`, html, 'utf8' );
			// Save in json report
			fs.promises.writeFile( `${config.reportDir}/report-${name}.json`, JSON.stringify( testResult, null, '  ' ), 'utf8' );
		} );

	} catch ( error ) {
		// Output an error if it occurred
		console.error( error.message );
	}
}

function setupCLI() {
	const { program } = require( 'commander' );

	program
		.requiredOption( '-e, --env <env>', 'determine which urls tests are run on, development or ci' )
		.option( '-s, --silent', 'avoids logging results summary to console', false )
		.option( '-l, --logResults', 'log a11y results to Graphite, should only be used with --env ci', false )
		.action( ( opts ) => {
			runTests( opts );
		} );

	program.parse();
}

setupCLI();