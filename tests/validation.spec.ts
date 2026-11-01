import { test, expect } from '@playwright/test';
import {
  EnlistmentForm, REQUIRED_ERRORS, CHOOSE_OPTION_ERROR, INVALID_PHONE_ERROR,
} from './enlistment-form';

// Validation checks. Every test leaves at least one required field empty,
// so Wix rejects the form in the browser and nothing is ever submitted.

let form: EnlistmentForm;

test.beforeEach(async ({ page }) => {
  form = new EnlistmentForm(page);
  await form.goto();
});

test.describe('Required fields', () => {
  test('empty form shows an error for every required field', async () => {
    await form.clickSubmit();
    for (const message of Object.values(REQUIRED_ERRORS)) {
      await expect(form.errorText(message), `error "${message}"`).toBeVisible();
    }
    // Membership type and payment method each show "Choose an option."
    await expect(form.errorText(CHOOSE_OPTION_ERROR)).toHaveCount(2);

    for (const field of [form.firstName, form.lastName, form.address, form.city, form.zip,
      form.cellPhone, form.email, form.signature]) {
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    }
    // Nothing went through: no confirmation, still on the form.
    await expect(form.submit).toBeVisible();
  });

  test('optional fields never show errors on an empty submit', async () => {
    await form.clickSubmit();
    await expect(form.homePhone).not.toHaveAttribute('aria-invalid', 'true');
    for (let n = 1; n <= 7; n++) {
      await expect(form.familyName(n)).not.toHaveAttribute('aria-invalid', 'true');
      await expect(form.familyAge(n)).not.toHaveAttribute('aria-invalid', 'true');
    }
  });

  // Fill one required field at a time and confirm only its error clears.
  const textFields = [
    { name: 'first name', key: 'firstName', value: "Mary-Kate O'Brien", error: REQUIRED_ERRORS.firstName },
    { name: 'last name', key: 'lastName', value: 'Chamberlain', error: REQUIRED_ERRORS.lastName },
    { name: 'address', key: 'address', value: '123 Little Round Top Rd.', error: REQUIRED_ERRORS.address },
    { name: 'city', key: 'city', value: 'San José', error: REQUIRED_ERRORS.city },
    { name: 'zip', key: 'zip', value: '95127', error: REQUIRED_ERRORS.zip },
    { name: 'email', key: 'email', value: 'smoketest@example.com', error: REQUIRED_ERRORS.email },
    { name: 'signature', key: 'signature', value: 'Joshua L. Chamberlain', error: REQUIRED_ERRORS.signature },
  ] as const;

  for (const f of textFields) {
    test(`filling ${f.name} clears its error`, async () => {
      await form.clickSubmit();
      await expect(form.errorText(f.error)).toBeVisible();
      await form[f.key].fill(f.value);
      await form.clickSubmit();
      await expect(form.errorText(f.error)).toBeHidden();
      await expect(form[f.key]).not.toHaveAttribute('aria-invalid', 'true');
      await expect(form[f.key]).toHaveValue(f.value);
      // Form is still incomplete, so other errors remain.
      await expect(form.errorText(REQUIRED_ERRORS.agreement)).toBeVisible();
    });
  }

  test('choosing a country clears its error', async () => {
    await form.clickSubmit();
    await form.chooseCountry('United States');
    await form.clickSubmit();
    await expect(form.errorText(REQUIRED_ERRORS.country)).toBeHidden();
  });

  test('choosing United States adds a required State field, which clears when picked', async () => {
    await expect(form.state).toHaveCount(0);
    await form.chooseCountry('United States');
    await expect(form.state).toBeVisible();
    await form.clickSubmit();
    // Membership, payment and now State each show "Choose an option."
    await expect(form.errorText(CHOOSE_OPTION_ERROR)).toHaveCount(3);
    await form.chooseState('California');
    await expect(form.state).toHaveValue('California');
    await form.clickSubmit();
    await expect(form.errorText(CHOOSE_OPTION_ERROR)).toHaveCount(2);
    await expect(form.errorText(REQUIRED_ERRORS.country)).toBeHidden();
  });

  test('cell phone with +1 country code clears its error', async () => {
    await form.clickSubmit();
    await form.chooseCellPhoneCountryUS();
    await form.cellPhone.fill('4085551234');
    await form.clickSubmit();
    await expect(form.errorText(REQUIRED_ERRORS.firstName)).toBeVisible(); // validation ran
    await expect(form.cellPhone).not.toHaveAttribute('aria-invalid', 'true');
    await expect(form.errorText(REQUIRED_ERRORS.cellPhone)).toBeHidden();
  });

  test('picking membership and payment clears both option errors', async () => {
    await form.clickSubmit();
    await expect(form.errorText(CHOOSE_OPTION_ERROR)).toHaveCount(2);
    await form.pick(form.membershipFamily, 'Individual or Family - $45');
    await form.clickSubmit();
    await expect(form.errorText(CHOOSE_OPTION_ERROR)).toHaveCount(1);
    await form.pick(form.payCheck, /^Check mailed to Cpl\. Bolland/);
    await form.clickSubmit();
    await expect(form.errorText(CHOOSE_OPTION_ERROR)).toHaveCount(0);
  });

  test('checking the agreement clears its error', async () => {
    await form.clickSubmit();
    await form.pick(form.agreement, /I have read and agree to the enlistment agreement/);
    await form.clickSubmit();
    await expect(form.errorText(REQUIRED_ERRORS.agreement)).toBeHidden();
  });

  test('picking a date clears its error', async () => {
    await form.clickSubmit();
    await form.chooseToday();
    await form.clickSubmit();
    await expect(form.errorText(REQUIRED_ERRORS.date)).toBeHidden();
  });
});

test.describe('Email format', () => {
  for (const bad of ['abc', 'abc@', 'abc@gmail', 'a b@c.com']) {
    test(`rejects "${bad}"`, async () => {
      await form.email.fill(bad);
      await form.clickSubmit();
      await expect(form.email).toHaveAttribute('aria-invalid', 'true');
      await expect(form.errorText(REQUIRED_ERRORS.email)).toBeVisible();
    });
  }

  for (const good of ['smoketest@example.com', "o'brien+test@gmail.com", 'first.last@sub.example.org']) {
    test(`accepts "${good}"`, async () => {
      await form.email.fill(good);
      await form.clickSubmit();
      await expect(form.errorText(REQUIRED_ERRORS.firstName)).toBeVisible(); // validation ran
      await expect(form.email).not.toHaveAttribute('aria-invalid', 'true');
      await expect(form.errorText(REQUIRED_ERRORS.email)).toBeHidden();
    });
  }
});

test.describe('Cell phone format (with +1 selected)', () => {
  test.beforeEach(async () => {
    await form.chooseCellPhoneCountryUS();
  });

  for (const bad of ['408555', '123']) {
    test(`rejects "${bad}"`, async () => {
      await form.cellPhone.fill(bad);
      await form.clickSubmit();
      await expect(form.cellPhone).toHaveAttribute('aria-invalid', 'true');
      await expect(form.errorText(INVALID_PHONE_ERROR)).toBeVisible();
    });
  }

  for (const good of ['4085551234', '(408) 555-1234', '408-555-1234']) {
    test(`accepts "${good}"`, async () => {
      await form.cellPhone.fill(good);
      await form.clickSubmit();
      await expect(form.errorText(REQUIRED_ERRORS.firstName)).toBeVisible(); // validation ran
      await expect(form.cellPhone).not.toHaveAttribute('aria-invalid', 'true');
      await expect(form.errorText(INVALID_PHONE_ERROR)).toBeHidden();
    });
  }
});

test.describe('Choices', () => {
  test('membership options are mutually exclusive', async () => {
    await form.pick(form.membershipFamily, 'Individual or Family - $45');
    await form.pick(form.membershipStudent, 'Single Student - $20');
    await expect(form.membershipStudent).toBeChecked();
    await expect(form.membershipFamily).not.toBeChecked();
  });

  test('payment options are mutually exclusive', async () => {
    await form.pick(form.payOnline, 'Online (payment link to follow)');
    await form.pick(form.payCheck, /^Check mailed to Cpl\. Bolland/);
    await expect(form.payCheck).toBeChecked();
    await expect(form.payOnline).not.toBeChecked();
  });
});
