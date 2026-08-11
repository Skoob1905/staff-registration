# Step 1

Step 1: Detect and Strip Non-Header Rows (Metadata / Banners)
In raw CSV uploads, the true table headers often don't start on line 1 because of top-level metadata, blank rows, or merged title banners (like "Monthly Payroll Report - July"). Step 1 identifies where the actual table headers begin and strips away everything above them.

The Process:
Parse the CSV Raw Content: Read the raw CSV content line-by-line or parse it into a 2D array of rows (string[][]).

Scan the Top Rows: Inspect the first few lines of the file (typically up to the first 30 rows).

Score Each Row Against Target Sets:

For each row, normalize its cell values (convert to lowercase, strip non-alphanumeric characters).

Count how many cells in that row match any of your predefined target sets (REF_SET, FORENAME_SET, SURNAME_SET, EMAIL_SET).

Identify the True Header Index: The row with the highest match count is selected as the true header row index (headerIdx).

Slice the Data: Discard all rows from index 0 up to headerIdx - 1.

Row headerIdx becomes your Header Row (column names).

Rows headerIdx + 1 onward become your Data Records.

# Step 2

In the CSV cleaner JavaScript instructions, Step 2 focuses on Set-Based Normalization and Target Matching.Here is what Step 2 entails:Step 2: Define Normalization Sets for Target HeadersCreate a Helper Normalization Function: Write a small utility function that converts strings to lowercase and strips out all non-alphanumeric characters (spaces, dashes, underscores, etc.).JavaScriptconst normalize = (text) =>
typeof text === 'string'
? text.toLowerCase().replace(/[^a-z0-9]/g, '')
: '';
Construct Standardized Target Set Objects: Define JavaScript Set instances containing all possible normalized variants for the 4 key columns so lookup performance is fast and efficient ($O(1)$ time complexity):JavaScript// Target 1: Reference / Payroll / Worker Number
const REF_SET = new Set([
'payrollno', 'payrollnumber', 'workerno', 'workernumber',
'worksnumber', 'worksno', 'empno', 'employeeno',
'ref', 'reference', 'staffid', 'workerid'
]);

// Target 2: Forename / First Name
const FORENAME_SET = new Set([
'forename', 'forename1', 'firstname', 'firstname1',
'givenname', 'first', 'first_name'
]);

// Target 3: Surname / Last Name
const SURNAME_SET = new Set([
'surname', 'lastname', 'secondname', 'familyname',
'last', 'last_name'
]);

// Target 4: Email Address
const EMAIL_SET = new Set([
'email', 'emailaddress', 'mail', 'mailaddress',
'useremail', 'e_mail'
]);

# Step 3

Step 3: Match and Map ColumnsIterate over the header array extracted in Step 1.For each header, apply normalize(header).Perform membership checks using .has() on each set:If match found in REF_SET and ref not yet assigned $\rightarrow$ Map column to ref.If match found in FORENAME_SET and forename not yet assigned $\rightarrow$ Map column to forename.If match found in SURNAME_SET and surname not yet assigned $\rightarrow$ Map column to surname.If match found in EMAIL_SET and email not yet assigned $\rightarrow$ Map column to email.Keep track of mapped indices vs. unmapped indices.If any of the four standard fields (ref, forename, surname, email) are missing in the source headers, insert them with empty string values ("") across all rows.

# Step 4

Step 4: Reorder Columns & Structure Output
Assemble the finalized column ordering:

Column Index 0: ref

Column Index 1: forename

Column Index 2: surname

Column Index 3: email

Column Index 4+: All remaining unmapped columns in their original relative sequence.

Transform each data row to conform strictly to this layout.

Return the clean output either as an array of objects (Record<string, string>[]) or converted back to a CSV string using PapaParse (Papa.unparse(...)).

# Possible Implmentation

import Papa from 'papaparse';

/\*\*

- Clean and standardize uploaded CSV content
- @param {string} csvText - Raw CSV text content
- @returns {string} Cleaned CSV text
  \*/
  export function cleanCSV(csvText) {
  // 1. Parse into matrix
  const parseResult = Papa.parse(csvText, { skipEmptyLines: true });
  const rawRows = parseResult.data;

if (!rawRows || rawRows.length === 0) return '';

const normalize = (val) => String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const REF_SET = new Set(['payrollno', 'payrollnumber', 'workerno', 'workernumber', 'worksnumber', 'worksno', 'empno', 'employeeno', 'ref', 'reference', 'staffid']);
const FORENAME_SET = new Set(['forename', 'forename1', 'firstname', 'firstname1', 'givenname', 'first']);
const SURNAME_SET = new Set(['surname', 'lastname', 'secondname', 'familyname', 'last']);
const EMAIL_SET = new Set(['email', 'emailaddress', 'mail', 'mailaddress', 'useremail']);

// 2. Locate header row index
let headerIdx = 0;
let maxMatches = -1;

const searchLimit = Math.min(30, rawRows.length);
for (let i = 0; i < searchLimit; i++) {
const row = rawRows[i];
let matches = 0;
row.forEach(cell => {
const norm = normalize(cell);
if (REF_SET.has(norm) || FORENAME_SET.has(norm) || SURNAME_SET.has(norm) || EMAIL_SET.has(norm)) {
matches++;
}
});
if (matches > maxMatches) {
maxMatches = matches;
headerIdx = i;
}
}

const headers = rawRows[headerIdx];
const dataRows = rawRows.slice(headerIdx + 1);

// 3. Map targets
const targetMap = {}; // index -> 'ref' | 'forename' | 'surname' | 'email'
const foundTargets = new Set();
const unmappedIndices = [];

headers.forEach((header, idx) => {
const norm = normalize(header);
if (!foundTargets.has('ref') && REF_SET.has(norm)) {
targetMap[idx] = 'ref';
foundTargets.add('ref');
} else if (!foundTargets.has('forename') && FORENAME_SET.has(norm)) {
targetMap[idx] = 'forename';
foundTargets.add('forename');
} else if (!foundTargets.has('surname') && SURNAME_SET.has(norm)) {
targetMap[idx] = 'surname';
foundTargets.add('surname');
} else if (!foundTargets.has('email') && EMAIL_SET.has(norm)) {
targetMap[idx] = 'email';
foundTargets.add('email');
} else {
unmappedIndices.push(idx);
}
});

// 4. Build output header & rows
const targetOrder = ['ref', 'forename', 'surname', 'email'];
const finalHeaders = [...targetOrder, ...unmappedIndices.map(i => headers[i])];

const cleanedRows = dataRows.map(row => {
const record = {};

    // Fill targets
    targetOrder.forEach(target => {
      const srcIdx = Object.keys(targetMap).find(k => targetMap[k] === target);
      record[target] = srcIdx !== undefined ? (row[srcIdx] || '') : '';
    });

    // Fill unmapped
    unmappedIndices.forEach(idx => {
      const originalHeader = headers[idx];
      record[originalHeader] = row[idx] || '';
    });

    return record;

});

return Papa.unparse(cleanedRows);
}
