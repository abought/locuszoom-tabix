/**
 * Sniffers: auto detect file format and parsing options for GWAS files.
 *  TODO: Reorganize code base and move more logic here
 */

import { MISSING_VALUES, _parsePvalToLog, _parseMarker, _missingToNull } from './parser_utils';

function isNumeric(val) {
    // Check whether an unparsed string is a numeric value"
    if (MISSING_VALUES.has(val)) {
        return true;
    }
    return !Number.isNaN(+val);
}

function isHeader(row, { comment_char = '#', delimiter = '\t' } = {}) {
    // This assumes two basic rules: the line is not a comment, and gwas data is more likely
    // to be numeric than headers
    return row.startsWith(comment_char) || row.split(delimiter).every(item => !isNumeric(item));
}

/**
 * Compute the levenshtein distance between two strings. Useful for finding the single best column
 *  name that matches a given rule.
 *  @private
 */
function levenshtein(a, b) { // https://github.com/trekhleb/javascript-algorithms
    // Create empty edit distance matrix for all possible modifications of
    // substrings of a to substrings of b.
    const distanceMatrix = Array(b.length + 1)
        .fill(null)
        .map(() => Array(a.length + 1)
            .fill(null));

    // Fill the first row of the matrix.
    // If this is first row then we're transforming empty string to a.
    // In this case the number of transformations equals to size of a substring.
    for (let i = 0; i <= a.length; i += 1) {
        distanceMatrix[0][i] = i;
    }

    // Fill the first column of the matrix.
    // If this is first column then we're transforming empty string to b.
    // In this case the number of transformations equals to size of b substring.
    for (let j = 0; j <= b.length; j += 1) {
        distanceMatrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            distanceMatrix[j][i] = Math.min(
                distanceMatrix[j][i - 1] + 1, // deletion
                distanceMatrix[j - 1][i] + 1, // insertion
                distanceMatrix[j - 1][i - 1] + indicator, // substitution
            );
        }
    }
    return distanceMatrix[b.length][a.length];
}

/**
 * Return the index of the first column name that meets acceptance criteria
 * @param {String[]} column_synonyms
 * @param {String[]}header_names
 * @param {Number} threshold Tolerance for fuzzy matching (# edits)
 * @return {Number|null} Index of the best matching column, or null if no match possible
 */
function findColumn(column_synonyms, header_names, threshold = 2) {
    // Find the column name that best matches
    let best_score = threshold + 1;
    let best_match = null;
    for (let i = 0; i < header_names.length; i++) {
        const header = header_names[i];
        if (header === null) {
            // If header is empty, don't consider it for a match
            // Nulling a header provides a way to exclude something from future searching
            continue; // eslint-disable-line no-continue
        }
        const score = Math.min(...column_synonyms.map(s => levenshtein(header, s)));
        if (score < best_score) {
            best_score = score;
            best_match = i;
        }
    }
    return best_match;
}


/**
 * Return parser configuration for pvalues
 *
 * Returns 1-based column indices, for compatibility with parsers
 * @param header_row
 * @param data_rows
 * @returns {{}}
 */
function getPvalColumn(header_row, data_rows) {
    // TODO: Allow overrides
    const LOGPVALUE_FIELDS = ['neg_log_pvalue', 'log_pvalue', 'log_pval', 'logpvalue'];
    const PVALUE_FIELDS = ['pvalue', 'p.value', 'pval', 'p_score', 'p'];

    let ps;
    const validateP = (col, data, is_log) => { // Validate pvalues
        const cleaned_vals = _missingToNull(data.map(row => row[col]));
        try {
            ps = cleaned_vals.map(p => _parsePvalToLog(p, is_log));
        } catch (e) {
            return false;
        }
        return ps.every(val => !Number.isNaN(val));
    };

    const log_p_col = findColumn(LOGPVALUE_FIELDS, header_row);
    const p_col = findColumn(PVALUE_FIELDS, header_row);

    if (log_p_col !== null && validateP(log_p_col, data_rows, true)) {
        return {
            pval_col: log_p_col + 1,
            is_log_pval: true,
        };
    }
    if (p_col && validateP(p_col, data_rows, false)) {
        return {
            pval_col: p_col + 1,
            is_log_pval: false,
        };
    }
    // Could not auto-determine an appropriate pvalue column
    return null;
}


function getChromPosRefAltColumns(header_row, data_rows) {
    // Returns 1-based column indices, for compatibility with parsers
    // Get from either a marker, or 4 separate columns
    const MARKER_FIELDS = ['snpid', 'marker', 'markerid', 'snpmarker'];
    const CHR_FIELDS = ['chrom', 'chr'];
    const POS_FIELDS = ['position', 'pos', 'begin', 'beg', 'bp', 'end', 'ps'];

    // TODO: How to handle orienting ref vs effect?
    // Order matters: consider ambiguous field names for ref before alt
    const REF_FIELDS = ['A1', 'ref', 'reference', 'allele0', 'allele1'];
    const ALT_FIELDS = ['A2', 'alt', 'alternate', 'allele1', 'allele2'];

    const first_row = data_rows[0];
    let marker_col = findColumn(MARKER_FIELDS, header_row);
    if (marker_col !== null && _parseMarker(first_row[marker_col], true)) {
        marker_col += 1;
        return { marker_col };
    }

    // If single columns were incomplete, attempt to auto detect 4 separate columns. All 4 must
    //  be found for this function to report a match.
    const headers_marked = header_row.slice();
    const find = [
        ['chr_col', CHR_FIELDS],
        ['pos_col', POS_FIELDS],
        ['ref_col', REF_FIELDS],
        ['alt_col', ALT_FIELDS],
    ];
    const config = {};
    for (let i = 0; i < find.length; i++) {
        const [col_name, choices] = find[i];
        const col = findColumn(choices, headers_marked);
        if (col === null) {
            return null;
        }
        config[col_name] = col + 1;
        // Once a column has been assigned, remove it from consideration
        headers_marked[col] = null;
    }
    return config;
}

/**
 *
 * @param {String[]} header_row
 * @param {String[][]} data_rows
 * @param {int} offset Used to convert between 0 and 1-based indexing.
 */
function guessGWAS(header_row, data_rows, offset = 1) {
    // 1. Find a specific set of info: marker OR chr/pos/ref/alt ; pvalue OR log_pvalue
    // 2. Validate that we will be able to parse the required info: fields present and make sense
    // 3. Based on the field names selected, attempt to infer meaning: verify whether log is used,
    //  and check ref/alt vs effect/noneffect
    // 4. Return a parser config object if all tests pass, OR null.

    // Normalize case and remove leading comment marks from line for easier comparison
    const headers = header_row.map(item => (item ? item.toLowerCase() : item));
    headers[0].replace('/^#+/', '');
    // Lists of fields are drawn from Encore (AssocResultReader) and Pheweb (conf_utils.py)
    const pval_config = getPvalColumn(headers, data_rows, offset);
    if (!pval_config) {
        return null;
    }
    headers[pval_config.pval_col - 1] = null; // Remove this column from consideration
    const position_config = getChromPosRefAltColumns(headers, data_rows);

    if (pval_config && position_config) {
        return Object.assign({}, pval_config, position_config);
    }
    return null;
}

export {
    // Public members
    guessGWAS,
    isNumeric,
    isHeader,
    // Symbols exported for testing
    getPvalColumn as _getPvalColumn,
    findColumn as _findColumn,
    levenshtein as _levenshtein,
};