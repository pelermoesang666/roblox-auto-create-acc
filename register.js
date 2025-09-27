const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const { execSync } = require('child_process');

puppeteer.use(StealthPlugin());

class ChromeFinder {
    static findChromePath() {
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        ];

        for (const path of possiblePaths) {
            if (path && fs.existsSync(path)) {
                console.log(`✅ Found Chrome at: ${path}`);
                return path;
            }
        }
        return null;
    }
}

class RobloxRegister {
    constructor() {
        this.browser = null;
        this.page = null;
        this.usernameBase = '';
        this.emails = [];
        this.currentUsernameIndex = 1;
        this.currentEmailIndex = 0;
        this.chromePath = ChromeFinder.findChromePath();
    }

    loadData() {
        try {
            if (fs.existsSync('username.txt')) {
                this.usernameBase = fs.readFileSync('username.txt', 'utf8').trim();
                console.log(`✅ Username base: ${this.usernameBase}`);
            } else {
                this.usernameBase = 'user';
                console.log('⚠️ username.txt not found, using default username');
            }

            if (fs.existsSync('list-email.txt')) {
                const emailContent = fs.readFileSync('list-email.txt', 'utf8');
                this.emails = emailContent.split('\n')
                    .map(email => email.trim())
                    .filter(email => email.length > 0 && email.includes('@'));
                console.log(`✅ Loaded ${this.emails.length} emails`);
            } else {
                this.emails = ['test@example.com'];
                console.log('⚠️ list-email.txt not found, using default email');
            }
        } catch (error) {
            console.error('❌ Error loading data:', error.message);
            this.usernameBase = 'user';
            this.emails = ['test@example.com'];
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async initBrowser() {
        console.log('🚀 Starting browser...');
        
        if (!this.chromePath) {
            throw new Error('❌ Chrome not found! Please install Google Chrome.');
        }

        const browserOptions = {
            executablePath: this.chromePath,
            headless: false,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1400,900',
                '--start-maximized'
            ],
            ignoreHTTPSErrors: true,
            slowMo: 100
        };

        this.browser = await puppeteer.launch(browserOptions);
        this.page = await this.browser.newPage();
        
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('✅ Browser ready');
    }

    async takeScreenshot(name) {
        try {
            await this.page.screenshot({ path: `screenshot-${name}.png`, fullPage: true });
            console.log(`📸 Screenshot saved: screenshot-${name}.png`);
        } catch (error) {
            console.log('❌ Failed to take screenshot');
        }
    }

    async findElement(selectors, timeout = 15000) {
        const selectorTypes = Array.isArray(selectors) ? selectors : [selectors];
        
        for (const selector of selectorTypes) {
            try {
                console.log(`🔍 Searching for: ${selector}`);
                
                if (selector.startsWith('//')) {
                    await this.page.waitForXPath(selector, { timeout: timeout });
                    const elements = await this.page.$x(selector);
                    if (elements.length > 0) {
                        console.log(`✅ Found element with XPath: ${selector}`);
                        return elements[0];
                    }
                } else {
                    await this.page.waitForSelector(selector, { timeout: timeout });
                    const element = await this.page.$(selector);
                    if (element) {
                        console.log(`✅ Found element with CSS: ${selector}`);
                        return element;
                    }
                }
            } catch (error) {
                console.log(`❌ Not found: ${selector}`);
            }
        }
        console.log(`❌ All selectors not found: ${selectorTypes.join(', ')}`);
        return null;
    }

    async fillField(selector, value, fieldName) {
        try {
            const element = await this.findElement(selector);
            if (!element) {
                throw new Error(`${fieldName} field not found`);
            }

            await element.click({ clickCount: 3 });
            await this.delay(500);
            await element.press('Backspace');
            await this.delay(500);

            await element.type(value, { delay: 80 });
            await this.delay(1500);

            console.log(`✅ ${fieldName} filled: ${value}`);
            return true;
        } catch (error) {
            throw new Error(`Failed to fill ${fieldName}: ${error.message}`);
        }
    }

    async checkUsernameAvailability(username) {
        try {
            const usernameSelectors = [
                '//*[@id="signup-username"]',
                'input[name="username"]',
                '#signup-username',
                'input[type="text"][placeholder*="username" i]',
                'input[data-testid="username-input"]'
            ];

            await this.fillField(usernameSelectors, username, 'Username');
            await this.delay(3000);

            const errorSelectors = [
                '//*[@id="signup-usernameInputValidation"]',
                '.validation-error',
                '.error-message',
                '[class*="error"]',
                '[class*="invalid"]'
            ];

            for (const selector of errorSelectors) {
                const errorElement = await this.findElement(selector, 3000);
                if (errorElement) {
                    const errorText = await this.page.evaluate(el => el.textContent, errorElement);
                    console.log(`📝 Error text: ${errorText}`);
                    if (errorText.toLowerCase().includes('already') || 
                        errorText.toLowerCase().includes('taken') ||
                        errorText.toLowerCase().includes('unavailable')) {
                        return false;
                    }
                }
            }

            return true;
        } catch (error) {
            console.log(`⚠️ Error checking username: ${error.message}`);
            return false;
        }
    }

    async selectBirthday() {
        console.log('📅 Filling birthday information...');
        
        try {
            const monthSelectors = [
                '//*[@id="MonthDropdown"]',
                'select[name="birthdayMonth"]',
                '#MonthDropdown',
                'select[aria-label*="month" i]',
                'select[data-testid*="month" i]',
                'select:nth-of-type(1)'
            ];

            const monthDropdown = await this.findElement(monthSelectors);
            if (!monthDropdown) {
                await this.takeScreenshot('month-dropdown-missing');
                throw new Error('Month dropdown not found');
            }

            console.log('✅ Month dropdown found, selecting November (11)...');
            await monthDropdown.select('11');
            await this.delay(2000);

            const daySelectors = [
                '//*[@id="DayDropdown"]',
                'select[name="birthdayDay"]',
                '#DayDropdown',
                'select[aria-label*="day" i]',
                'select[data-testid*="day" i]',
                'select:nth-of-type(2)'
            ];

            const dayDropdown = await this.findElement(daySelectors);
            if (!dayDropdown) {
                throw new Error('Day dropdown not found');
            }

            console.log('✅ Day dropdown found, selecting 11...');
            await dayDropdown.select('11');
            await this.delay(2000);

            const yearSelectors = [
                '//*[@id="YearDropdown"]',
                'select[name="birthdayYear"]',
                '#YearDropdown',
                'select[aria-label*="year" i]',
                'select[data-testid*="year" i]',
                'select:nth-of-type(3)'
            ];

            const yearDropdown = await this.findElement(yearSelectors);
            if (!yearDropdown) {
                throw new Error('Year dropdown not found');
            }

            console.log('✅ Year dropdown found, selecting 1999...');
            await yearDropdown.select('1999');
            await this.delay(2000);

            console.log('✅ Birthday filled successfully');
            return true;

        } catch (error) {
            await this.takeScreenshot('birthday-error');
            throw new Error(`Failed to select birthday: ${error.message}`);
        }
    }

    async clickCheckbox() {
        console.log('☑️ Looking for checkbox...');
        
        const checkboxSelectors = [
            '//*[@id="signup-checkbox"]',
            'input[type="checkbox"]',
            '.checkbox',
            '#signup-checkbox',
            'input[name="terms"]',
            'input[aria-label*="agree" i]'
        ];
        
        const checkbox = await this.findElement(checkboxSelectors, 5000);
        
        if (checkbox) {
            console.log('✅ Checkbox found, clicking...');
            
            const isChecked = await this.page.evaluate((element) => {
                return element.checked;
            }, checkbox);
            
            if (!isChecked) {
                await checkbox.click();
                await this.delay(1500);
                
                const isNowChecked = await this.page.evaluate((element) => {
                    return element.checked;
                }, checkbox);
                
                if (isNowChecked) {
                    console.log('✅ Checkbox successfully checked');
                } else {
                    console.log('⚠️ Checkbox may not be checked properly');
                }
            } else {
                console.log('✅ Checkbox already checked');
            }
            
            return true;
        } else {
            console.log('⚠️ Checkbox not found, continuing without checking...');
            return false;
        }
    }

    async clickSignupButton() {
        console.log('🚀 Looking for signup button...');
        
        const signupButtonSelectors = [
            '//*[@id="signup-button"]',
            'button[type="submit"]',
            'button[id*="signup"]',
            '#signup-button',
            'button[data-testid*="signup" i]',
            'button:contains("Sign Up")',
            'button:contains("Register")'
        ];
        
        const signupButton = await this.findElement(signupButtonSelectors);
        
        if (!signupButton) {
            await this.takeScreenshot('signup-button-missing');
            throw new Error('Signup button not found');
        }
        
        console.log('✅ Signup button found, clicking...');
        await signupButton.click();
        await this.delay(5000);
        
        return true;
    }

    async registerAccount(accountNumber) {
        console.log(`\n📝 Starting registration for account #${accountNumber}`);
        
        try {
            console.log('🌐 Navigating to registration page...');
            await this.page.goto('https://www.roblox.com/', {
                waitUntil: 'networkidle2',
                timeout: 40000
            });
            await this.delay(5000);
            await this.takeScreenshot('01-page-loaded');

            let username;
            let usernameAvailable = false;
            let attempts = 0;

            while (!usernameAvailable && attempts < 5) {
                username = `${this.usernameBase}${this.currentUsernameIndex.toString().padStart(5, '0')}`;
                console.log(`🔍 Testing username: ${username} (Attempt ${attempts + 1})`);

                usernameAvailable = await this.checkUsernameAvailability(username);
                
                if (!usernameAvailable) {
                    console.log(`❌ Username ${username} is taken`);
                    this.currentUsernameIndex++;
                    attempts++;
                    await this.delay(2000);
                }
            }

            if (!usernameAvailable) {
                throw new Error('Could not find available username after 5 attempts');
            }

            console.log(`✅ Username ${username} is available`);
            await this.takeScreenshot('02-username-filled');

            const password = "@Grimgarenyawdesu90";
            const passwordSelectors = [
                '//*[@id="signup-password"]',
                'input[name="password"]',
                'input[type="password"]',
                '#signup-password',
                'input[data-testid="password-input"]'
            ];
            
            await this.fillField(passwordSelectors, password, 'Password');
            await this.takeScreenshot('03-password-filled');

            await this.selectBirthday();
            await this.takeScreenshot('04-birthday-filled');

            await this.clickCheckbox();
            await this.takeScreenshot('05-checkbox-clicked');

            await this.clickSignupButton();
            await this.takeScreenshot('06-after-signup-click');

            const currentUrl = this.page.url();
            console.log(`🔗 Current URL: ${currentUrl}`);

            if (currentUrl.includes('captcha') || currentUrl.includes('verify')) {
                console.log('🎯 Captcha detected! Please solve manually...');
                console.log('⏳ Waiting 2 minutes for manual solving...');
                
                const startTime = Date.now();
                while (Date.now() - startTime < 120000) {
                    const url = this.page.url();
                    if (url.includes('home') || url.includes('welcome')) {
                        console.log('✅ Captcha solved!');
                        break;
                    }
                    await this.delay(5000);
                    console.log('⏳ Still waiting for captcha solution...');
                }
            }

            await this.delay(5000);
            const finalUrl = this.page.url();
            console.log(`🔗 Final URL: ${finalUrl}`);
            
            if (finalUrl.includes('home') || finalUrl.includes('welcome') || finalUrl.includes('roblox.com')) {
                console.log('✅ Registration successful!');
                return { username, password, success: true };
            } else {
                await this.takeScreenshot('07-registration-failed');
                throw new Error('Registration failed - not redirected to home');
            }

        } catch (error) {
            await this.takeScreenshot('error-' + accountNumber);
            console.error(`❌ Registration failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async run(accountCount = 1) {
        console.log('🤖 Starting Roblox Register Bot with Debugging\n');
        this.loadData();

        try {
            await this.initBrowser();
            let successCount = 0;

            for (let i = 0; i < accountCount; i++) {
                console.log(`\n🎯 ===== ACCOUNT ${i + 1}/${accountCount} =====`);

                const result = await this.registerAccount(i + 1);

                if (result.success) {
                    const accountData = {
                        username: result.username,
                        password: result.password,
                        registeredAt: new Date().toLocaleString('id-ID'),
                        accountNumber: i + 1
                    };

                    this.saveAccount(accountData);
                    successCount++;
                    console.log(`🎉 Account ${i + 1} completed successfully!`);
                } else {
                    console.log(`❌ Account ${i + 1} failed: ${result.error}`);
                }

                if (i < accountCount - 1) {
                    const delay = 15000;
                    console.log(`⏳ Waiting ${delay/1000}s before next account...`);
                    await this.delay(delay);
                }
            }

            console.log(`\n📊 FINAL REPORT: ${successCount}/${accountCount} accounts created successfully`);

        } catch (error) {
            console.error('💥 Critical error:', error.message);
        } finally {
            if (this.browser) {
                await this.delay(3000);
                await this.browser.close();
                console.log('🔚 Browser closed');
            }
        }
    }

    saveAccount(accountData) {
        const filename = 'accounts.json';
        let accounts = [];

        if (fs.existsSync(filename)) {
            try {
                accounts = JSON.parse(fs.readFileSync(filename, 'utf8'));
            } catch (error) {
                accounts = [];
            }
        }

        accounts.push(accountData);
        fs.writeFileSync(filename, JSON.stringify(accounts, null, 2));
        console.log(`💾 Account saved: ${accountData.username}`);
    }
}

const bot = new RobloxRegister();
const accountCount = process.argv[2] ? parseInt(process.argv[2]) : 1;

if (accountCount > 0) {
    bot.run(accountCount);
} else {
    console.log('Usage: node register.js [number_of_accounts]');
}
