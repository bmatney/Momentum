import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const config = JSON.parse(read('capacitor.config.json'));
const release = JSON.parse(read('release.config.json'));
const errors = [];
const requireCheck = (condition, message) => { if (!condition) errors.push(message); };
requireCheck(!config.server?.url, 'Remove the development server URL.');
requireCheck(!config.server?.cleartext, 'Disable cleartext development traffic.');
requireCheck(!config.ios?.webContentsDebuggingEnabled && !config.android?.webContentsDebuggingEnabled,
  'Disable forced WebView debugging.');
requireCheck(config.loggingBehavior === 'none', 'Disable bridge logging for the store build.');
requireCheck(/^https:\/\//.test(release.privacyPolicyUrl), 'Provide a public HTTPS privacy-policy URL.');
requireCheck(/^https:\/\//.test(release.supportUrl), 'Provide a public HTTPS support URL.');
requireCheck(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(release.supportEmail), 'Provide the public support email.');
requireCheck(release.storeVersionConfirmed === true, 'Confirm unused store version/build numbers before uploading.');
requireCheck(!/\[Insert|CONTACT_REQUIRED|\\rtf1/.test(read('privacy.md')), 'Finish the privacy policy contact information.');
if (errors.length) {
  console.error('Release preparation is incomplete:\n' + errors.map(e => `- ${e}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Local release configuration checks passed. Native archives, signing, device testing, and store review are still required.');
}
