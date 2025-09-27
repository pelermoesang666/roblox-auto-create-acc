const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const { execSync } = require('child_process');
const axios = require('axios');

puppeteer.use(StealthPlugin());

class CaptchaSolver {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://2captcha.com';
    }

    async solveArkoseCaptcha(pageUrl, siteKey = 'A2A14B03-D9BC-FFB1-1463-920C5B9311AD') {
        try {
            console.log('🔍 Sending captcha to 2Captcha...');
            
            const submitData = {
                key: this.apiKey,
                method: 'funcaptcha',
                publickey: siteKey,
                pageurl: pageUrl,
                surl: 'https://roblox-api.arkoselabs.com',
                json: 1
            };

            console.log('📦 Captcha data:', {
                pageurl: pageUrl,
                publickey: siteKey
            });

            const submitResponse = await axios.post(`${this.baseUrl}/in.php`, submitData, {
                timeout: 30000
            });

            if (submitResponse.data.status !== 1) {
                throw new Error(`Failed to submit captcha: ${submitResponse.data.request}`);
            }

            const captchaId = submitResponse.data.request;
            console.log(`✅ Captcha submitted, ID: ${captchaId}`);

            // Tunggu hasil solving (max 3 menit)
            for (let i = 0; i < 36; i++) {
                await this.delay(5000); // Check setiap 5 detik
                
                try {
                    const resultResponse = await axios.get(`${this.baseUrl}/res.php`, {
                        params: {
                            key: this.apiKey,
                            action: 'get',
                            id: captchaId,
                            json: 1
                        },
                        timeout: 10000
                    });

                    if (resultResponse.data.status === 1) {
                        console.log('✅ Captcha solved successfully!');
                        return resultResponse.data.request; // Return token
                    } else if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
                        throw new Error(`Captcha solving error: ${resultResponse.data.request}`);
                    }

                    console.log(`⏳ Waiting for captcha solution... (${i + 1}/36)`);
                } catch (error) {
                    console.log(`⚠️ Error checking captcha status: ${error.message}`);
                }
            }

            throw new Error('Timeout solving captcha (3 minutes)');
        } catch (error) {
            console.error('❌ Error solving captcha:', error.message);
            return null;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

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
        this.captchaSolver = new CaptchaSolver('YOUR_API_KEY');
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
            ignoreHTTPSErrors: true
        };

        this.browser = await puppeteer.launch(browserOptions);
        this.page = await this.browser.newPage();
        
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('✅ Browser ready');
    }

    async takeScreenshot(name) {
        try {
            await this.page.screenshot({ path: `screenshot-${name}.png` });
            console.log(`📸 Screenshot saved: screenshot-${name}.png`);
        } catch (error) {
            console.log('❌ Failed to take screenshot');
        }
    }

    async findElement(selectors, timeout = 15000) {
        const selectorTypes = Array.isArray(selectors) ? selectors : [selectors];
        
        for (const selector of selectorTypes) {
            try {
                if (selector.startsWith('//')) {
                    await this.page.waitForXPath(selector, { timeout: timeout });
                    const elements = await this.page.$x(selector);
                    if (elements.length > 0) {
                        return elements[0];
                    }
                } else {
                    await this.page.waitForSelector(selector, { timeout: timeout });
                    const element = await this.page.$(selector);
                    if (element) {
                        return element;
                    }
                }
            } catch (error) {
                // Continue to next selector
            }
        }
        return null;
    }

    async detectCaptcha() {
        console.log('🔍 Checking for captcha...');
        
        try {
            // Check multiple indicators of captcha presence
            const captchaIndicators = await this.page.evaluate(() => {
                const indicators = {
                    hasArkoseIframe: false,
                    hasFunCaptcha: false,
                    hasCaptchaText: false,
                    hasChallenge: false,
                    url: window.location.href
                };

                // Check for Arkose Labs iframe
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    const src = iframe.src || '';
                    if (src.includes('arkoselabs.com') || src.includes('funcaptcha')) {
                        indicators.hasArkoseIframe = true;
                    }
                });

                // Check for FunCaptcha elements
                if (document.querySelector('.fc-container') || 
                    document.querySelector('[class*="arkose"]') ||
                    document.querySelector('#FunCaptcha')) {
                    indicators.hasFunCaptcha = true;
                }

                // Check for captcha-related text
                const bodyText = document.body.innerText.toLowerCase();
                if (bodyText.includes('captcha') || 
                    bodyText.includes('robot') || 
                    bodyText.includes('verify') ||
                    bodyText.includes('challenge')) {
                    indicators.hasCaptchaText = true;
                }

                // Check URL for captcha indicators
                if (indicators.url.includes('captcha') || 
                    indicators.url.includes('verify') ||
                    indicators.url.includes('challenge')) {
                    indicators.hasChallenge = true;
                }

                return indicators;
            });

            console.log('📊 Captcha detection results:', captchaIndicators);

            // Jika ada indikator captcha
            if (captchaIndicators.hasArkoseIframe || 
                captchaIndicators.hasFunCaptcha || 
                captchaIndicators.hasChallenge) {
                console.log('🎯 CAPTCHA DETECTED!');
                return true;
            }

            // Additional check: Look for captcha elements directly
            const captchaElements = [
                '.fc-container',
                '[class*="arkose"]',
                '#FunCaptcha',
                'iframe[src*="arkoselabs"]',
                'iframe[src*="funcaptcha"]'
            ];

            for (const selector of captchaElements) {
                const element = await this.findElement(selector, 2000);
                if (element) {
                    console.log(`✅ Captcha element found: ${selector}`);
                    return true;
                }
            }

            console.log('✅ No captcha detected');
            return false;

        } catch (error) {
            console.error('❌ Error detecting captcha:', error.message);
            return false;
        }
    }

    async solveCaptchaAutomatically() {
        try {
            console.log('🤖 Starting automatic captcha solving...');
            
            const currentUrl = this.page.url();
            console.log(`🔗 Current URL: ${currentUrl}`);
            
            // Site key untuk Roblox Arkose Labs
            const siteKey = 'A2A14B03-D9BC-FFB1-1463-920C5B9311AD';
            
            console.log('🔑 Using site key:', siteKey);
            
            // Solve captcha menggunakan 2Captcha
            const token = await this.captchaSolver.solveArkoseCaptcha(currentUrl, siteKey);
            
            if (!token) {
                throw new Error('Failed to get captcha token from 2Captcha');
            }

            console.log('✅ Captcha token received:', token.substring(0, 50) + '...');

            // Inject token ke halaman
            const injectionResult = await this.page.evaluate((token) => {
                try {
                    // Coba berbagai method untuk submit token
                    if (window.fc_solve) {
                        window.fc_solve(token);
                        return 'fc_solve_called';
                    }
                    
                    // Cari input hidden untuk token
                    const tokenInput = document.querySelector('input[name="fc-token"], input[name="captcha_token"]');
                    if (tokenInput) {
                        tokenInput.value = token;
                        return 'token_input_filled';
                    }
                    
                    // Coba trigger event
                    const event = new Event('captchaSolved');
                    window.dispatchEvent(event);
                    
                    return 'event_dispatched';
                } catch (error) {
                    return 'error: ' + error.message;
                }
            }, token);

            console.log('🔧 Token injection result:', injectionResult);
            
            // Tunggu sebentar setelah inject token
            await this.delay(3000);
            
            // Coba submit form jika masih ada
            const submitButton = await this.findElement([
                'button[type="submit"]',
                'input[type="submit"]',
                '.btn-primary',
                'button:contains("Submit")',
                'button:contains("Verify")'
            ]);
            
            if (submitButton) {
                console.log('🚀 Clicking submit button after captcha...');
                await submitButton.click();
                await this.delay(5000);
            }

            return true;

        } catch (error) {
            console.error('❌ Automatic captcha solving failed:', error.message);
            return false;
        }
    }

    async handleCaptcha() {
        console.log('🎯 Handling captcha...');
        
        const captchaDetected = await this.detectCaptcha();
        
        if (!captchaDetected) {
            console.log('✅ No captcha to handle');
            return true;
        }

        await this.takeScreenshot('before-captcha');

        // Coba solve otomatis dulu
        console.log('🔄 Attempting automatic captcha solving...');
        const autoSolved = await this.solveCaptchaAutomatically();
        
        if (autoSolved) {
            // Tunggu dan verifikasi captcha solved
            await this.delay(5000);
            
            const stillCaptcha = await this.detectCaptcha();
            if (!stillCaptcha) {
                console.log('✅ Captcha solved automatically!');
                await this.takeScreenshot('after-captcha-auto');
                return true;
            }
        }

        // Fallback ke manual solving
        console.log('🔄 Fallback to manual captcha solving...');
        console.log('⏳ Please solve the captcha manually in the browser window...');
        console.log('💡 You have 3 minutes to solve the captcha');
        
        const startTime = Date.now();
        const timeout = 180000; // 3 menit
        
        while (Date.now() - startTime < timeout) {
            const stillHasCaptcha = await this.detectCaptcha();
            
            if (!stillHasCaptcha) {
                console.log('✅ Manual captcha solved!');
                await this.takeScreenshot('after-captcha-manual');
                return true;
            }
            
            await this.delay(10000); // Check setiap 10 detik
            console.log('⏳ Still waiting for manual captcha solution...');
        }
        
        console.log('❌ Captcha solving timeout');
        return false;
    }

    async fillField(selector, value, fieldName) {
        try {
            const element = await this.findElement(selector);
            if (!element) {
                throw new Error(`${fieldName} field not found`);
            }

            await element.click({ clickCount: 3 });
            await this.delay(300);
            await element.press('Backspace');
            await this.delay(300);

            await element.type(value, { delay: 50 });
            await this.delay(1000);

            console.log(`✅ ${fieldName} filled`);
            return true;
        } catch (error) {
            throw new Error(`Failed to fill ${fieldName}`);
        }
    }

    async checkUsernameAvailability(username) {
        try {
            const usernameSelectors = [
                '//*[@id="signup-username"]',
                'input[name="username"]',
                '#signup-username'
            ];

            await this.fillField(usernameSelectors, username, 'Username');
            await this.delay(2000);

            const errorSelectors = [
                '//*[@id="signup-usernameInputValidation"]',
                '.validation-error'
            ];

            for (const selector of errorSelectors) {
                const errorElement = await this.findElement(selector, 2000);
                if (errorElement) {
                    const errorText = await this.page.evaluate(el => el.textContent, errorElement);
                    if (errorText.toLowerCase().includes('already') || 
                        errorText.toLowerCase().includes('taken')) {
                        return false;
                    }
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    async selectBirthday() {
        console.log('📅 Filling birthday...');
        
        try {
            const monthDropdown = await this.findElement(['//*[@id="MonthDropdown"]']);
            if (!monthDropdown) throw new Error('Month dropdown not found');
            await monthDropdown.select('11');
            
            const dayDropdown = await this.findElement(['//*[@id="DayDropdown"]']);
            if (!dayDropdown) throw new Error('Day dropdown not found');
            await dayDropdown.select('11');
            
            const yearDropdown = await this.findElement(['//*[@id="YearDropdown"]']);
            if (!yearDropdown) throw new Error('Year dropdown not found');
            await yearDropdown.select('1999');

            await this.delay(1000);
            return true;
        } catch (error) {
            throw new Error(`Failed to select birthday: ${error.message}`);
        }
    }

    async registerAccount(accountNumber) {
        console.log(`\n📝 Starting registration for account #${accountNumber}`);
        
        try {
            // Step 1: Navigate to registration page
            console.log('🌐 Navigating to registration page...');
            await this.page.goto('https://www.roblox.com/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            await this.delay(4000);

            // Step 2: Check for initial captcha
            await this.handleCaptcha();

            // Step 3: Find available username
            let username;
            let usernameAvailable = false;
            let attempts = 0;

            while (!usernameAvailable && attempts < 10) {
                username = `${this.usernameBase}${this.currentUsernameIndex.toString().padStart(5, '0')}`;
                console.log(`🔍 Testing username: ${username}`);

                usernameAvailable = await this.checkUsernameAvailability(username);
                
                if (!usernameAvailable) {
                    this.currentUsernameIndex++;
                    attempts++;
                    await this.delay(1000);
                }
            }

            if (!usernameAvailable) {
                throw new Error('Could not find available username');
            }

            // Step 4: Fill password
            const password = "@Grimgarenyawdesu90";
            await this.fillField(['//*[@id="signup-password"]'], password, 'Password');

            // Step 5: Fill birthday
            await this.selectBirthday();

            // Step 6: Click checkbox
            const checkbox = await this.findElement(['//*[@id="signup-checkbox"]']);
            if (checkbox) {
                await checkbox.click();
                await this.delay(1000);
            }

            // Step 7: Click signup button
            const signupButton = await this.findElement(['//*[@id="signup-button"]']);
            if (!signupButton) {
                throw new Error('Signup button not found');
            }

            await signupButton.click();
            await this.delay(5000);

            // Step 8: Handle captcha after signup click
            const captchaHandled = await this.handleCaptcha();
            
            if (!captchaHandled) {
                throw new Error('Captcha not solved');
            }

            // Step 9: Verify success
            await this.delay(5000);
            const finalUrl = this.page.url();
            
            // Lebih flexible dalam mendefinisikan success
            if (finalUrl.includes('home') || 
                finalUrl.includes('welcome') || 
                finalUrl.includes('roblox.com') &&
                !finalUrl.includes('captcha') &&
                !finalUrl.includes('verify')) {
                console.log('✅ Registration successful!');
                return { username, password, success: true };
            } else {
                throw new Error('Registration failed - not redirected to success page');
            }

        } catch (error) {
            console.error(`❌ Registration failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async run(accountCount = 1) {
        console.log('🤖 Starting Roblox Register Bot with Advanced Captcha Detection\n');
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

// Install: npm install puppeteer-extra puppeteer-extra-plugin-stealth axios

const bot = new RobloxRegister();
const accountCount = process.argv[2] ? parseInt(process.argv[2]) : 1;

if (accountCount > 0) {
    bot.run(accountCount);
} else {
    console.log('Usage: node register-captcha-fixed.js [number_of_accounts]');
}
