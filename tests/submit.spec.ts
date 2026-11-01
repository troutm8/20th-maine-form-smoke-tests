import { test, expect } from '@playwright/test';
import { EnlistmentForm, CONFIRMATION_TEXT } from './enlistment-form';

// Full end-to-end submission. THIS SENDS A REAL SUBMISSION: all 12 officers get
// the notification email and Wix creates a contact. It only runs when
// SUBMIT_TEST=1 (see README) and only in the desktop project.
// Afterwards, delete the "SMOKETEST" submission and contact in the Wix dashboard.

test.skip(process.env.SUBMIT_TEST !== '1', 'Real submission: set SUBMIT_TEST=1 to run');

test('complete form submits and shows the confirmation message', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Submit once per run, not once per device');

  const form = new EnlistmentForm(page);
  await form.goto();

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  await form.firstName.fill('SMOKETEST');
  await form.lastName.fill(`Automated check ${stamp}`);
  await form.chooseCountry('United States');
  await form.address.fill('123 Test St. (automated test - please ignore)');
  await form.city.fill('San Jose');
  await form.chooseState('California'); // State appears once United States is chosen
  await form.zip.fill('95127');
  await form.chooseCellPhoneCountryUS();
  await form.cellPhone.fill('4085550100');
  await form.email.fill(process.env.SUBMIT_TEST_EMAIL ?? 'smoketest@example.com');
  await form.familyName(1).fill('SMOKETEST Child');
  await form.familyAge(1).fill('12');
  await form.pick(form.membershipFamily, 'Individual or Family - $45');
  await form.pick(form.payCheck, /^Check mailed to Cpl\. Bolland/);
  await form.pick(form.agreement, /I have read and agree to the enlistment agreement/);
  await form.signature.fill('SMOKETEST Automated Check');
  await form.chooseToday();

  await form.clickSubmit();
  await expect(page.getByText(CONFIRMATION_TEXT)).toBeVisible({ timeout: 20_000 });
});
