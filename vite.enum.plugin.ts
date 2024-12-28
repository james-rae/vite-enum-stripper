/*
Strips enums, replaces with raw constant values.

ASSUMPTIONS:
build output is in a single file `build/assets/<package-name>.js`

Example:
this defintion

const enum MyEnum {
    NumberEnumItem = 123,
    StringEnumItem = 'ABC'
}

will look like this after Vite grinds it (shortened vars can be any random identifiers)

ac=(e=>(e[e.NumberEnumItem=123]="NumberEnumItem",e.StringEnumItem="ABC",e))(ac||{})

and its use in Vite'd code:
if (cb === ac.StringEnumItem) {

*/

import path from 'path';
import fs from 'fs';
import packageJson from './package.json';

type EnumDef = {
    /**
     * Minified var name for the enum throughout the code
     */
    publicRoot: string;

    /**
     * Minified var name for the enum within its generator definition
     */
    innerRoot: string;

    /**
     * Entire minified enum definition
     */
    fullDefinition: string;
};

/**
 * Create a bundle of info about an enum definition
 *
 * @param {string} publicRoot
 * @param {string} innerRoot
 * @param {string} fullDefinition
 * @returns {EnumDef} enum definition object
 */
const makeEnumDef = (publicRoot: string, innerRoot: string, fullDefinition: string): EnumDef => {
    return {
        publicRoot,
        innerRoot,
        fullDefinition
    };
};

/**
 * Checks if a character is valid for an identifier
 *
 * @param {string} testChar a single character string (length === 1)
 * @returns {boolean} true if alphanumeric, underscore, or dolla sign. false otherwise
 */
const isIdentChar = (testChar: string): boolean => {
    const charCode = testChar.charCodeAt(0);
    return (
        (charCode > 47 && charCode < 58) ||
        (charCode > 96 && charCode < 123) ||
        (charCode > 64 && charCode < 91) ||
        testChar === '_' ||
        testChar === '$'
    );
};

/**
 * Sort comparitor based on string length, makes longest length come first
 */
const sortByLongest = (str1: string, str2: string): number => {
    const l1 = str1.length;
    const l2 = str2.length;
    if (l1 === l2) {
        return 0;
    } else if (l1 > l2) {
        return -1;
    } else {
        return 1;
    }
};

/**
 * Strips string enums, replaces with raw string values
 *
 * @param {string} path location of js file to strip
 */
async function enumParser(path: string) {
    /**
     * File content to parse
     */
    const inputData = await fs.promises.readFile(path, 'utf8');

    /**
     * Current position crawling through input data
     */
    let readIdx = 0;

    /**
     * Current position of input data where we have already written out
     */
    let writeIdx = 0;

    /**
     * Data we are writing out.
     */
    let outData = '';

    /**
     * Marks if we are stil processing data
     */
    let notDone = true;

    /**
     * List of enum definitions we've found
     */
    const enumsFound: Array<EnumDef> = [];

    const modes = {
        /**
         * fresh attempt to find an enum
         */
        new: 'new',
        /**
         * parsing something that could be the public root
         */
        proot: 'proot',
        /**
         * parsing something that could be the inner root
         */
        iroot: 'iroot',
        /**
         * parsing definition guts
         */
        guts: 'guts',
        /**
         * parsing the end of the definition
         */
        end: 'end'
    };

    /**
     * Current parse mode
     */
    let mode = modes.new;

    /**
     * What we think is the public root of the enum we are inspecting
     */
    let currPRoot = '';

    /**
     * What we think is the inner root of the enum we are inspecting
     */
    let currIRoot = '';

    /**
     * Where we think our current enum block starts. Will likely be a var or comma
     */
    let currIdx = 0;

    /**
     * True if current enum began with a var declaration. False would indicate it followed a comma
     */
    let startVar = false;

    /**
     * Resets tracking vars for a specific enum
     */
    const reset = () => {
        currIdx = 0;
        currIRoot = '';
        currPRoot = '';
        mode = modes.new;
    };

    /**
     * Infinite loop insurance
     */
    let emergCounter = 0;

    while (notDone) {
        if (mode === modes.new) {
            // hunt for next potential definition
            // ----------

            const defIdxVar = inputData.indexOf('var ', readIdx);
            const defIdxComma = inputData.indexOf(',', readIdx);
            if (defIdxComma === -1 && defIdxVar === -1) {
                // we can find no more potential enums. Write out to the end. Exit loop.
                outData = outData.concat(inputData.slice(writeIdx));
                notDone = false;
            } else {
                let properStartIdx: number;
                if (defIdxComma === -1 || defIdxVar === -1) {
                    // only one existed. don't pick the -1
                    properStartIdx = Math.max(defIdxComma, defIdxVar);
                } else {
                    // both existed. pick the one closer to where we are reading from
                    properStartIdx = Math.min(defIdxComma, defIdxVar);
                }
                startVar = !(inputData.slice(properStartIdx, properStartIdx + 1) === ',');

                // ready to advance our state
                mode = modes.proot;
                currIdx = properStartIdx;
                readIdx = properStartIdx + (startVar ? 4 : 1); // advance to where the public root should be defined

                // write out stuff up to where we are parsing (will be non-enum things, keep as is)
                outData = outData.concat(inputData.slice(writeIdx, currIdx));
                writeIdx = currIdx;
            }
        } else if (mode === modes.proot) {
            // we are attempting to find if a) we are actually on an enum, and b) what the public root name is for that enum.
            // ----------

            // inspect the next character
            const nextChar = inputData.slice(readIdx, readIdx + 1);
            if (isIdentChar(nextChar)) {
                // keep building the identifier
                currPRoot = currPRoot.concat(nextChar);
                readIdx++;
            } else if (nextChar === '=' && inputData.slice(readIdx + 1, readIdx + 2) === '(' && currPRoot !== '') {
                // have found the end of a valid identifier, and the two chars after match our pattern
                // set up vars to start attempting to parse an inner root

                mode = modes.iroot;
                readIdx += 2;
                // console.log(`Found potential public root: ${currPRoot}`);
            } else {
                // appears we have not matched our pattern. probably not dealing with an enum
                reset();
            }
        } else if (mode === modes.iroot) {
            // we are attempting to find what the inner root name is for the current enum.
            // ----------

            // inspect the next character
            const nextChar = inputData.slice(readIdx, readIdx + 1);
            if (isIdentChar(nextChar)) {
                // keep building the identifier
                currIRoot = currIRoot.concat(nextChar);
                readIdx++;
            } else if (nextChar === '=' && inputData.slice(readIdx + 1, readIdx + 3) === '>(' && currIRoot !== '') {
                // have found the end fo a valid identifier, and the three chars after match our pattern
                // set up vars to start attemting parse the guts

                mode = modes.guts;
                readIdx += 3;
                // console.log(`Found potential inner root: ${currIRoot}`);
            } else {
                // appears we have not matched our pattern. probably not dealing with an enum
                reset();
            }
        } else if (mode === modes.guts) {
            // hunt for end of the definition guts of this enum
            // ----------

            const endNugget = `,${currIRoot}))(${currPRoot}||{})`;
            const gutsEnd = inputData.indexOf(endNugget, readIdx);
            if (gutsEnd === -1) {
                // could not find the end. likely not in an enum
                reset();
            } else {
                // sanity check the middle, just incase we have a similar pattern but is not actually an enum definition
                const guts = inputData.slice(readIdx, gutsEnd);
                const splitGuts = guts.split(',');

                // pre-calc string enum prefix, number enum prefix
                const strPre = currIRoot.concat('.');
                const numPre = `${currIRoot}[${strPre}`;

                // matching test: starts with one of the valid prefixes, ends with double-quote, contains an equals.
                const allGood = splitGuts.every(
                    gut => (gut.startsWith(strPre) || gut.startsWith(numPre)) && gut.indexOf('=') > -1 && gut.endsWith('"')
                );

                if (allGood) {
                    // proceed to end mode to process the enum
                    mode = modes.end;
                    readIdx = gutsEnd + endNugget.length;
                } else {
                    // structure wasn't an enum
                    reset();
                }
            }
        } else if (mode === modes.end) {
            // appears we have matched a full enum definition pattern. ship it.
            // ----------

            const newDef = makeEnumDef(currPRoot, currIRoot, inputData.slice(currIdx, readIdx));
            enumsFound.push(newDef);
            if (startVar) {
                // this def was first in a var declaration. keep the var since there might be things coming after it.
                outData = outData.concat('var ');
            }

            // advance to after the enum. We will not write it out.
            writeIdx = readIdx;

            // bakc to the beginning.
            reset();
        }

        if (emergCounter > 99999999) {
            console.warn('Hit the emergency counter kickout.');
            notDone = false;
        }
        emergCounter++;
    }

    // at this point, we've found and stripped all enum definitions.
    // now to clean the rest of the file.

    // scan for `var ,`, remove the comma. Scan for `var ;`, remove entirely.
    outData = outData.replaceAll('var ;', '');
    outData = outData.replaceAll('var ,', 'var ');

    // sort public roots to avoid replace errors (e.g. hitting `xy` first when `xyz` exists is bad)
    enumsFound.sort((ed1, ed2) => sortByLongest(ed1.publicRoot, ed2.publicRoot));

    // process every enum
    enumsFound.forEach(enumDef => {
        // extract guts
        const rawStart = enumDef.fullDefinition.indexOf(`=>(`) + 3;
        const rawEnd = enumDef.fullDefinition.indexOf(`,${enumDef.innerRoot}))`);
        const rawGuts = enumDef.fullDefinition.slice(rawStart, rawEnd);
        const prefixLen = enumDef.innerRoot.length;
        const numFormat = `${enumDef.innerRoot}[${enumDef.innerRoot}.`;
        const gutNuggets = rawGuts.split(',').map(s => {
            // <!> this needs to handle both formats
            let enumDef: string;

            if (s.startsWith(numFormat)) {
                // number format
                // strip out relevant definition from the reverse map-o-tron

                const numStart = prefixLen + 1; // prefix[
                const numEnd = s.indexOf(']=');
                enumDef = s.substring(numStart, numEnd);
            } else {
                // string format, take entire nugget
                enumDef = s;
            }
            const eqSplit = enumDef.split('=');
            return {
                key: eqSplit[0].slice(prefixLen), // drops the inner root, so t.FUN becomes .FUN
                val: eqSplit[1]
            };
        });

        // sort so we don't make replace errors
        gutNuggets.sort((g1, g2) => sortByLongest(g1.key, g2.key));

        // replace enum references with raw values
        gutNuggets.forEach(gutNug => {
            outData = outData.replaceAll(`${enumDef.publicRoot}${gutNug.key}`, gutNug.val);
        });
    });

    const snippedPath = path.slice(0, path.length - 3);
    const outfileBackup = snippedPath + '.orig.js';
    const outfileLog = snippedPath + '.elog.txt';

    // backup the original
    await fs.promises.cp(path, outfileBackup);

    // overwrite the original
    await fs.promises.writeFile(path, outData, 'utf8');

    // write out enum log
    const logger = enumsFound.map(nug => nug.fullDefinition).join('\n');
    await fs.promises.writeFile(outfileLog, logger, 'utf8');
}

const enumStripperPlugin = () => {
    return {
        name: 'enum-stripper',
        async closeBundle() {
            const srcPath = path.resolve(__dirname, `build/assets/${packageJson.name}.js`);
            await enumParser(srcPath);
            console.log('Un-enumified, donethanks');
        }
    };
};

export { enumStripperPlugin };
