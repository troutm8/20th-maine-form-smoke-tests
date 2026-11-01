import { test, expect } from '@playwright/test';
import { EnlistmentForm, REQUIRED_ERRORS, INVALID_PHONE_ERROR } from './enlistment-form';

// Behaviour we'd LIKE the form to have but that it doesn't today (found while
// exploring the live form on Oct 30, 2026). These are tagged @known-gap and
// excluded from the nightly run so they don't send false alarms. Run them with
// `npm run test:gaps`; when one starts passing, move it into validation.spec.ts.

let form: EnlistmentForm;

test.beforeEach(async ({ page }) => {
  form = new EnlistmentForm(page);
  await form.goto();
});

test('US cell number is accepted without picking a country code first', { tag: '@known-gap' }, async () => {
  // Today: "(408) 555-1234" is rejected with "Enter a valid phone number." until the
  // member opens the flag menu and picks United States +1. Fix: set a default
  // country code of +1 on both phone fields in the Wix form editor.
  await form.cellPhone.fill('(408) 555-1234');
  await form.clickSubmit();
  await expect(form.errorText(REQUIRED_ERRORS.firstName)).toBeVisible(); // validation ran
  await expect(form.cellPhone).not.toHaveAttribute('aria-invalid', 'true');
  await expect(form.errorText(INVALID_PHONE_ERROR)).toBeHidden();
});

test('first name made only of spaces is rejected', { tag: '@known-gap' }, async () => {
  await form.firstName.fill('   ');
  await form.clickSubmit();
  await expect(form.errorText(REQUIRED_ERRORS.firstName)).toBeVisible();
});

test('negative family member age is rejected', { tag: '@known-gap' }, async () => {
  await form.familyAge(1).fill('-5');
  await form.clickSubmit();
  await expect(form.familyAge(1)).toHaveAttribute('aria-invalid', 'true');
});

test('unrealistic family member age is rejected', { tag: '@known-gap' }, async () => {
  await form.familyAge(1).fill('250');
  await form.clickSubmit();
  await expect(form.familyAge(1)).toHaveAttribute('aria-invalid', 'true');
});

test('one click on Submit is enough while the cursor is in an empty field', { tag: '@known-gap' }, async () => {
  // Today: click into an empty required field, then click Submit. Pressing the mouse
  // blurs the field, Wix shows that field's error, the page reflows and Submit moves
  // before the mouse is released, so the click is lost. Only one error appears and the
  // member has to click Submit again. EnlistmentForm.clickSubmit() works around this.
  await form.firstName.click();
  await form.submit.click(); // deliberately the raw click, not clickSubmit()
  await expect(form.errorText(REQUIRED_ERRORS.firstName)).toBeVisible();
  await expect(form.errorText(REQUIRED_ERRORS.lastName)).toBeVisible();
});
