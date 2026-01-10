import { test, expect } from '@playwright/test';

test.describe('Booking Cycle E2E', () => {

    // Helper to calculate "tomorrow" date string/number
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate().toString();
    const tomorrowDateStr = tomorrow.toLocaleDateString('en-CA'); // YYYY-MM-DD for some checks if needed, though UI uses click

    // Dynamic client email to ensure fresh state
    const clientEmail = `client_${Date.now()}@test.com`;
    const clientName = `Test Client ${Date.now()}`;

    test('Owner sets availability -> Client books -> Owner confirms', async ({ page }) => {

        // --- PART 1: OWNER SETUP ---
        await test.step('Owner: Login and Set Availability', async () => {
            await page.goto('/');

            // Switch to Owner Access
            await page.getByText('Owner Access').click();

            // Login
            await page.fill('input[type="email"]', 'owner@test.com');
            await page.fill('input[type="password"]', 'test123');
            await page.getByRole('button', { name: 'Sign In' }).click();

            // Wait for Owner View to load (check for "Schedule" tab)
            await expect(page.getByRole('button', { name: 'Schedule' })).toBeVisible();

            // Go to Availability Tab (Sub-navigation)
            // Note: This relies on the button name being "Availability"
            await page.getByRole('button', { name: 'Availability' }).click();

            // Select a Specific Date (e.g. 28th) to ensure enablement
            await page.getByRole('button', { name: '28', exact: true }).first().click({ force: true });

            // Wait for selection to reflect (check help text or UI state)
            // AvailabilityManager shows "Selected Dates: ..."
            await expect(page.getByText('Selected Dates')).toBeVisible();

            // Clear availability if any (to reset state)
            page.on('dialog', async dialog => await dialog.accept());
            if (await page.getByRole('button', { name: 'Clear Availability' }).isVisible()) {
                await page.getByRole('button', { name: 'Clear Availability' }).click();
                // Re-select after clear (as observed before)
                await page.getByRole('button', { name: '28', exact: true }).first().click({ force: true });
            }

            // Ensure "Add Time Range" is visible
            // Sometimes it's inside a conditional or requires "Selected Dates" to be non-zero.
            await expect(page.getByText('Selected Dates')).toContainText('28');

            const addBtn = page.getByRole('button', { name: 'Add Time Range' });
            await expect(addBtn).toBeVisible();
            await addBtn.click();

            // Set Time: 10:00 - 19:00
            const ranges = page.locator('select');
            await ranges.first().selectOption('10:00');
            await ranges.nth(1).selectOption('19:00');

            // Wait for "Save Changes" to be ENABLED
            const saveBtn = page.getByRole('button', { name: 'Save Changes' });
            await expect(saveBtn).toBeEnabled({ timeout: 5000 });
            await saveBtn.click();

            // Wait for Save to complete (Button goes disabled or text changes)
            // It changes to "Updating..." then "Save Changes". 
            // We can wait for it to be disabled again or check for success icon?
            // User requested: "Wait for 'Save Changes' button to become enabled. Click. Update script."
            // We clicked. Now let's just wait a bit for backend sync.
            await page.waitForTimeout(2000);

            // Logout
            await page.getByLabel('Logout').click();
            await expect(page.getByText('Client Access')).toBeVisible();
        });

        // --- PART 2: CLIENT BOOKING ---
        await test.step('Client: Register and Request Slot', async () => {
            // Ensure Client Access tab
            await page.getByText('Client Access').click();

            // Register new user
            await page.getByText('Register').click();
            await page.fill('input[placeholder="Your Name"]', clientName);
            await page.fill('input[type="email"]', clientEmail);
            // Password fields
            const passwordInputs = await page.locator('input[type="password"]').all();
            await passwordInputs[0].fill('password123');
            await passwordInputs[1].fill('password123');

            await page.getByRole('button', { name: 'Sign Up' }).click();

            // Verify Login (Client Dashboard)
            await expect(page.getByText('Book Treatment')).toBeVisible();

            // Select the same date we set (28th)
            await page.getByRole('button', { name: '28', exact: true }).first().click();

            // Find 10:00 AM slot
            const slotButton = page.getByRole('button', { name: '10:00' });
            await expect(slotButton).toBeVisible();
            await slotButton.click();

            // Confirm Request
            await page.getByRole('button', { name: 'Send Booking Request' }).click();

            // Verify Notification/Transition
            await expect(page.getByText('Request sent!')).toBeVisible();

            // Go to My Appointments
            await page.getByText('My Appointments').click();
            await expect(page.getByText('10:00')).toBeVisible();
            // Client UI might show "Pending Approval" or similar status text
            await expect(page.getByText('Pending Approval')).toBeVisible();

            // Logout
            await page.getByLabel('Logout').click();
        });

        // --- PART 3: OWNER VERIFICATION ---
        await test.step('Owner: Confirm Request', async () => {
            await page.getByText('Owner Access').click();
            await page.fill('input[type="email"]', 'owner@test.com');
            await page.fill('input[type="password"]', 'test123');
            await page.getByRole('button', { name: 'Sign In' }).click();

            // Go to Requests Tab
            await page.getByText('Requests').click();

            // Verify new request
            // Should see client name and time
            await expect(page.getByText(clientName)).toBeVisible();
            await expect(page.getByText('10:00')).toBeVisible();

            // Approve
            await page.getByText('Approve & Email').first().click();

            // Verify it disappeared from Pending
            await expect(page.getByText(clientName)).toBeHidden();

            // Check Schedule/Appointments
            await page.getByText('Schedule').click();
            // Switch to "Appointments" subtab (default 'view')
            await page.getByText('Appointments').click();

            // Select the date (28th)
            await page.getByRole('button', { name: '28', exact: true }).first().click();

            // Verify confirmed appointment
            await expect(page.getByText(clientName)).toBeVisible();
        });
    });
});
