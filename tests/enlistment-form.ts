import { expect, type Locator, type Page } from '@playwright/test';

export const FORM_PATH = '/enlistment-application';

/** Visible error text Wix shows for each required field when it's left empty. */
export const REQUIRED_ERRORS = {
  firstName: 'Enter a first name.',
  lastName: 'Enter a last name.',
  country: 'Choose a country/region.',
  address: 'Enter an address.',
  city: 'Enter a city.',
  zip: 'Enter a zip/postal code.',
  cellPhone: 'Enter a phone number.',
  email: 'Enter an email address like example@mysite.com.',
  agreement: 'Check the box to continue.',
  signature: 'Enter an answer.',
  date: 'Choose a date.',
} as const;
/** Membership type and payment method both use this message. */
export const CHOOSE_OPTION_ERROR = 'Choose an option.';
export const INVALID_PHONE_ERROR = 'Enter a valid phone number.';

export const CONFIRMATION_TEXT = 'Thank you for enlisting with the 20th Maine, Company G!';

/**
 * Page object for the enlistment form. Locators use labels and roles, not
 * Wix's generated element IDs, which change whenever the form is edited.
 */
export class EnlistmentForm {
  readonly form: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly country: Locator;
  readonly address: Locator;
  readonly city: Locator;
  readonly zip: Locator;
  readonly cellPhone: Locator;
  readonly cellPhoneCountry: Locator;
  readonly homePhone: Locator;
  readonly email: Locator;
  readonly membershipFamily: Locator;
  readonly membershipStudent: Locator;
  readonly payOnline: Locator;
  readonly payCheck: Locator;
  readonly agreement: Locator;
  readonly signature: Locator;
  readonly state: Locator;
  readonly date: Locator;
  readonly submit: Locator;

  constructor(readonly page: Page) {
    this.form = page.locator('form');
    const f = this.form;
    this.firstName = f.getByLabel('First name', { exact: true });
    this.lastName = f.getByLabel('Family last name', { exact: true });
    this.country = f.getByRole('combobox', { name: /Country\/Region/ });
    this.address = f.getByLabel('Address', { exact: true });
    this.city = f.getByLabel('City', { exact: true });
    this.zip = f.getByLabel('Zip / Postal code', { exact: true });
    // Only appears after a country with states/provinces (e.g. United States) is chosen.
    this.state = f.getByRole('combobox', { name: /^State/ });
    this.cellPhone = f.getByRole('textbox', { name: 'Cell phone. Phone', exact: true });
    this.cellPhoneCountry = f.getByRole('button', { name: 'Cell phone. Phone. Select a country code' });
    this.homePhone = f.getByRole('textbox', { name: 'Home phone (optional). Phone', exact: true });
    this.email = f.getByLabel('Email', { exact: true });
    this.membershipFamily = f.getByRole('radio', { name: 'Individual or Family - $45' });
    this.membershipStudent = f.getByRole('radio', { name: 'Single Student - $20' });
    this.payOnline = f.getByRole('radio', { name: 'Online (payment link to follow)' });
    this.payCheck = f.getByRole('radio', { name: /^Check mailed to Cpl\. Bolland/ });
    this.agreement = f.getByRole('checkbox', { name: /I have read and agree to the enlistment agreement/ });
    this.signature = f.getByLabel('Signature - type your full name', { exact: true });
    // Wix renders the date picker as a button. Its name is "Date" until a date is
    // picked, then "YYYY-MM-DD Date" (a separate "... Date Clear" button also appears).
    this.date = f.getByRole('button', { name: /^(\d{4}-\d{2}-\d{2} )?Date$/ });
    this.submit = f.getByRole('button', { name: 'Submit' });
  }

  familyName(n: number): Locator {
    return this.form.getByLabel(`Family member ${n} - full name`, { exact: true });
  }

  familyAge(n: number): Locator {
    return this.form.getByLabel(`Family member ${n} - age`, { exact: true });
  }

  /**
   * Checks a radio button or checkbox. Wix styles these with a hidden native
   * input, so if a normal check() can't reach it, click the visible label instead.
   */
  async pick(control: Locator, labelText: string | RegExp): Promise<void> {
    try {
      await control.check({ timeout: 3_000 });
    } catch {
      await this.form.getByText(labelText).first().click();
    }
    await expect(control).toBeChecked();
  }

  async goto(): Promise<void> {
    const response = await this.page.goto(FORM_PATH);
    expect(response?.status(), 'form page HTTP status').toBe(200);
    await expect(this.firstName).toBeVisible();
    await this.waitForHydration();
  }

  /**
   * Wix serves the form as static HTML first and React takes it over about a
   * second later. Clicks and typing before then are silently lost (Submit shows
   * no errors, dropdowns don't open), so wait until React has attached to a field.
   */
  async waitForHydration(): Promise<void> {
    await expect
      .poll(() => this.firstName.evaluate(el => Object.keys(el).some(k => k.startsWith('__react'))), {
        message: 'form JavaScript (React) did not initialise',
        timeout: 20_000,
      })
      .toBe(true);
  }

  /**
   * Clicks Submit. On an incomplete form Wix validates in the browser and nothing is sent.
   *
   * Focus is moved off the current field first, then we wait for Wix to react.
   * Pressing the mouse on Submit blurs whichever field has the cursor; Wix then
   * re-renders that field (an error message or a success state), the page reflows
   * and Submit moves before the mouse is released, so the click is lost (see
   * known-gaps.spec.ts). The re-render arrives a few hundred ms after the blur, so
   * a short pause is needed before the layout is really settled.
   */
  async clickSubmit(): Promise<void> {
    await this.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await this.page.waitForTimeout(500);
    await this.submit.click();
  }

  errorText(text: string): Locator {
    return this.form.getByText(text, { exact: true });
  }

  async chooseCountry(name = 'United States'): Promise<void> {
    await this.country.click();
    await this.country.fill(name);
    await this.page.getByRole('option', { name, exact: true }).click();
  }

  /** The State dropdown only exists once a country such as United States has been chosen. */
  async chooseState(name = 'California'): Promise<void> {
    await this.state.click();
    await this.state.fill(name);
    await this.page.getByRole('option', { name, exact: true }).click();
  }

  /** Wix has no default country code on phone fields; a US number is only valid once +1 is picked. */
  async chooseCellPhoneCountryUS(): Promise<void> {
    await this.cellPhoneCountry.click();
    await this.page.getByPlaceholder('Search').fill('United States');
    await this.page.getByRole('option').filter({ hasText: '+1' }).filter({ hasNotText: 'Minor' }).first().click();
  }

  /** Picks today's date (Pacific time) from the calendar popup; the field doesn't accept typing. */
  async chooseToday(): Promise<void> {
    await this.date.click();
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles',
    }); // e.g. "Friday, October 30, 2026" — matches the calendar cell's aria-label
    await this.page.getByRole('gridcell', { name: today }).click();
    await expect(this.date).toHaveAccessibleName(/^\d{4}-\d{2}-\d{2} Date$/); // e.g. "2026-10-30 Date"
  }
}
