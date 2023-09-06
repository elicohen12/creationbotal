/**
 * Automation buy items in skinport.com
 */


const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const _ = require('lodash')
const { click, type, disableLogger, asyncForEach, timeout, waitForNavigation, waitForURL } = require('puppeteer-utilz');
const { ask, Logger, wait, readFileAsync, writeFileAsync, executeCommand } = require('./utils.js')
const path = require('path');
const stealth = StealthPlugin();
puppeteer.use(StealthPlugin());
stealth.enabledEvasions.delete('iframe.contentWindow');
require('dotenv').config();


let browser
let page
let password
let email
let mode
const pathToScreen = path.join(process.cwd(), 'screenshot.png')


async function selectMenu(page, button_selector, key, selector, mode, index = 0) {
    await wait(500)
    if (index == 0) {
        await click({
            component: page,
            selector: button_selector
        })
        await page.waitForSelector(selector)
        if (mode == 'search') {
            await type(page, {
                selector: selector,
                value: key
            })
            await page.keyboard.press('Tab')
            await page.keyboard.press('Tab')
            await page.keyboard.press('Enter')
        } else {
            let indexes = await page.$$eval(selector, (elements) => {
                return elements.map(el => el.textContent)
            })
            let index
            for (let i = 0; i < indexes.length; i++) {
                if (indexes[i].includes(key)) { index = i; break }
            }
            let menus = await page.$$(selector)
            await menus[index].click()
        }
    } else {
        for (let i = 0; i < index; i++) {
            await page.keyboard.press('Tab')
        }
        await page.keyboard.press('Space')
        await page.waitForSelector(selector)
        if (mode == 'search') {
            await type(page, {
                selector: selector,
                value: key
            })
            await page.keyboard.press('Tab')
            await page.keyboard.press('Tab')
            await page.keyboard.press('Enter')
        } else {
            let indexes = await page.$$eval(selector, (elements) => {
                return elements.map(el => el.textContent)
            })
            let index
            for (let i = 0; i < indexes.length; i++) {
                if (indexes[i].includes(key)) index = i
            }
            let menus = await page.$$(selector)
            await menus[index].click()
        }
    }
    await wait(500)
}

async function getFakeEmail() {
    let fake;

    browser = await puppeteer.launch(
        {
            headless: "new",
            // executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
        }
    )

    page = await browser.newPage()

    await page.setRequestInterception(true);

    page.on('request', (request) => {
        if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
            request.abort();
        } else {
            request.continue();
        }
    });

    await page.setCacheEnabled(false);

    await page.goto('https://products.aspose.app/email/gmail-generator')
    await page.waitForSelector('#GmailQuery')
    await page.type('#GmailQuery', email)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')

    for (; ;) {
        let fake = await page.$eval('#GeneratedAddress', (el) => el.value == '')
        if (!fake) break
    }

    fake = await page.$eval('#GeneratedAddress', (el) => el.value)

    await page.close()
    await browser.close()
    return fake;
}


async function getFakeEmailFromTxt() {
    let fake;

    const pathToFake = path.join(process.cwd(), 'fake_email.txt')
    let fakes = await readFileAsync(pathToFake)
    fake = fakes.split('\r\n')[0]
    await writeFileAsync(pathToFake, fakes.split('\r\n').slice(1).join('\r\n'), 'w')
    return fake;
}


async function input(page, selector, key, delay = 0) {
    await page.waitForSelector(selector);
    await click({
        component: page,
        selector: selector,
        retries: 3
    });
    await page.type(selector, key, { delay: delay })
}


function numberToMonth(number) {
    const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];

    if (number >= 1 && number <= 12) {
        return months[number - 1];
    } else {
        throw new Error("Invalid month number. Please provide a number between 1 and 12.");
    }
}


async function Login(profile, fake) {
    const pathToExtension = path.join(process.cwd(), 'cookies')
    let options = {
        // executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
        defaultViewport: null,
        args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
            // '--force-device-scale-factor=0.75',
            '--start-maximized'
        ]
    }

    let headless = process.env.HEADLESS;
    options.headless = headless
    if (headless == 'false') options.headless = false
    
    browser = await puppeteer.launch(options)
    page = await browser.newPage()

    await page.setRequestInterception(true);

    page.on('request', (request) => {
        request.continue();
    });

    await page.setCacheEnabled(false);

    await page.goto('https://www.upwork.com/nx/signup/?dest=home')
    await click({
        component: page,
        selector: 'input[name="radio-group-2"]'
    })

    await click({
        component: page,
        selector: 'button[data-qa="btn-apply"]'
    })

    await input(page, '#first-name-input', profile['first_name'])
    await input(page, '#last-name-input', profile['last_name'])
    await input(page, '#redesigned-input-email', fake)
    await input(page, '#password-input', password)
    await selectMenu(page, '#dropdown-label-7', profile['country'], 'input.up-input[type="search"]', 'search')

    await click({
        component: page,
        selector: '#checkbox-terms'
    })

    await Promise.all([
        waitForURL(page, 'https://www.upwork.com/nx/signup/please-verify'),
        click({
            component: page,
            selector: '#button-submit-form'
        })
    ]);

    let href = '';

    console.log('Verifying ...');

    while (true) {
        const pathToMail = path.join(process.cwd(), 'read_email.py')
        href = await executeCommand(`cd ${process.cwd()} & python ${pathToMail}`)
        console.log(`Log => ${href}`);

        await page.goto(href);
        await wait(5000);

        let url = page.url();
        console.log(url);

        if (url.includes('create')) {
            break;
        } else if (url == 'https://www.upwork.com/nx/signup/please-verify?verified=true') {
            await page.$$eval('button', buttons => {
                const resendButton = buttons.find(button => button.textContent.includes("Resend"));
                resendButton.click();
            });
        } else if (url == 'https://www.upwork.com/nx/find-work/?verified=true') {
            await page.close();
            await browser.close();
            return false;
        }
    }

    'https://www.upwork.com/nx/signup/please-verify?verified=true'
    'https://www.upwork.com/nx/find-work/?verified=true'

    // await page.waitForSelector('button[data-qa="get-started-btn"]');

    while (true) {
        await click({
            component: page,
            selector: 'button[data-qa="get-started-btn"]'
        })

        await wait(3000);

        let pass = await page.$$('input[value="FREELANCED_BEFORE"]');
        if (pass.length) break;
    } 

    await click({
        component: page,
        selector: 'input[value="FREELANCED_BEFORE"]'
    })
    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    await click({
        component: page,
        selector: 'input[value="GET_EXPERIENCE"]'
    })

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    await click({
        component: page,
        selector: 'input[type="checkbox"]'
    })

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'div > button > span'
        })
    ])

    await page.type('input[aria-labelledby="title-label"][type="text"]', profile['professional']);

    // await input(page, 'input[aria-labelledby="title-label"][type="text"]', profile['professional'])

    await page.focus('button[data-test="next-button"]');

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    await click({
        component: page,
        selector: 'button[aria-labelledby="add-experience-label"]'
    })

    //// add Experience
    let exp = profile["workXP"]
    for (let i = 0; i < exp.length; i++) {
        if (i != 0) {
            await click({
                component: page,
                selector: "button.air3-btn.air3-btn-secondary.air3-btn-circle"
            });
        } else {
            // await page.type('input[aria-labelledby="title-label"][type="search"]', " ");
            await input(page, 'input[aria-labelledby="title-label"][type="search"]', " ")
        }
        
        await input(page, 'input[aria-labelledby="title-label"][type="search"]', exp[i]['role'])
        await input(page, 'input[aria-labelledby="company-label"]', exp[i]['company'])
        await input(page, 'input[aria-labelledby="location-label"]', exp[i]['location'])

        await selectMenu(page, 'div[aria-labelledby*="location-label"]', exp[i]['country'], 'input.air3-input.air3-input-sm', 'search')

        let s_m = exp[i]['start'].split('.')[1]
        let s_y = exp[i]['start'].split('.')[0]
        await selectMenu(page, 'div[aria-labelledby*="start-date-month"]', numberToMonth(s_m), 'span.air3-menu-item-text', 'combo')
        await selectMenu(page, 'div[aria-labelledby*="start-date-year"]', s_y, 'input.air3-input.air3-input-sm', 'search')

        let e_m = exp[i]['end'].split('.')[1]
        let e_y = exp[i]['end'].split('.')[0]
        await selectMenu(page, 'div[aria-labelledby*="end-date-month"]', numberToMonth(e_m), 'span.air3-menu-item-text', 'combo')
        await selectMenu(page, 'div[aria-labelledby*="end-date-year"]', e_y, 'input.air3-input.air3-input-sm', 'search')

        let text = exp[i]['description']
        text = text.map(el => {
            return '• ' + el;
        })

        text = text.join('\n')
        
        await page.$eval('textarea', (el, txt) => {
            el.value = txt;
        }, text);

        await click({
            component: page,
            selector: "textarea"
        })

        await page.type('textarea', ' ');
        
        await click({
            component: page,
            selector: 'button[data-qa="btn-save"]'
        })
    }

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    await click({
        component: page,
        selector: 'button[aria-labelledby="add-education-label"]'
    })

    //// add Education
    let edu = profile["education"]
    for (let i = 0; i < edu.length; i++) {
        if (i != 0) {
            await click({
                component: page,
                selector: "button.air3-btn.air3-btn-secondary.air3-btn-circle"
            })
        }

        await selectMenu(page, 'div[aria-labelledby*="dates-attended-label"]', edu[i]['start'], 'input.air3-input.air3-input-sm', 'search')
        await selectMenu(page, 'div[aria-labelledby*="dates-attended-label"]', edu[i]['end'], 'input.air3-input.air3-input-sm', 'search', 1)
        await input(page, 'input[aria-labelledby="school-label"]', edu[i]['university'])
        await input(page, 'input[aria-labelledby="degree-label"]', edu[i]['degree'])

        await click({
            component: page,
            selector: 'input[aria-labelledby="degree-label"]'
        })
        await wait(2000)
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')

        await input(page, 'input[aria-labelledby="area-of-study-label"]', edu[i]['field'])

        await click({
            component: page,
            selector: 'button[data-qa="btn-save"]'
        })
    }

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    //// skip certificates
    let url = await page.url()
    if (!url.includes('https://www.upwork.com/nx/create-profile/languages')) {
        await Promise.all([
            page.waitForNavigation(),
            click({
                component: page,
                selector: 'button[data-test="skip-button"]'
            })
        ])
    }

    //// add Languages
    let lang = profile["languages"]
    await selectMenu(page, 'div[aria-labelledby*="dropdown-label-english"]', lang['English'], 'span.air3-menu-item-text', 'combo')

    for (let i = 0; i < lang.length; i++) {
        //
    }

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    //// add Skills
    let skills = profile['skills']
    for (let i = 0; i < skills.length; i++) {
        // await input(page, 'input[aria-labelledby="skills-input"]', skills[i], 500)
        await page.type('input[aria-labelledby="skills-input"]', skills[i], { delay : 100 });
        await wait(500);
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')
    }

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    //// add Overview
    let overview = profile['overview']
    await page.waitForSelector('textarea[aria-labelledby="overview-label"]')
    await page.$eval('textarea[aria-labelledby="overview-label"]', (el, txt) => {
        el.value = txt;
    }, overview);
    await click({
        component: page,
        selector: 'textarea[aria-labelledby="overview-label"]'
    })
    await page.type('textarea[aria-labelledby="overview-label"]', ' ')

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    //// add Service
    let services = profile['services']
    await click({
        component: page,
        selector: 'div[aria-labelledby*="dropdown-search-multi-label"]'
    })
    let selector = 'span.air3-menu-checkbox-labels'
    await page.waitForSelector('span.air3-menu-checkbox-labels')
    let servicelist = await page.$$(selector)
    let toselect = -1
    for (let i = 0; i < services.length; i++) {
        for (let j = 0; j < servicelist.length; j++) {
            let text = await page.evaluate((index, selector) => {
                const items = Array.from(document.querySelectorAll(selector))
                return items[index].textContent
            }, j, selector);
            if (text.includes(services[i])) {
                toselect = j
                break
            }
        }

        if (toselect != -1) {
            let select = await page.evaluate((index, selector) => {
                const items = Array.from(document.querySelectorAll(selector))
                return items[index].parentNode.parentNode.getAttribute('aria-selected')
            }, toselect, selector);
            if (select == 'false') {
                await page.evaluate((index, selector) => {
                    const items = Array.from(document.querySelectorAll(selector))
                    return items[index].parentNode.parentNode.parentNode.parentNode.parentNode.click()
                }, toselect, selector);
                await wait(300)
                await page.evaluate((index, selector) => {
                    const items = Array.from(document.querySelectorAll(selector))
                    return items[index].parentNode.parentNode.click()
                }, toselect, selector)
            }
        }
    }

    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    //// set rate
    await input(page, 'input[data-ev-label="currency_input"]', profile['hourRate'])
    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })
    ])

    //// check profile
    await input(page, 'input[aria-labelledby="street-label"]', profile['street'])
    await input(page, 'input[aria-labelledby="city-label"]', ' ' + profile['city'])
    await wait(1500)
    await click({
        component: page,
        selector: 'span.air3-menu-item-text',
        retries: 3
    })
    await input(page, 'input[aria-labelledby="postal-code-label"]', profile['zipcode'])
    await input(page, 'input[aria-labelledby^="dropdown-label-phone-number"]', profile['phone'])
    await click({
        component: page,
        selector: 'button[data-qa="open-loader"]'
    })
    const pathToPicture = path.join(process.cwd(), profile['avatar'])
    await page.waitForSelector('input[type="file"]')
    const upload = await page.$('input[type="file"]')
    upload.uploadFile(pathToPicture)

    await page.waitForSelector('button[data-qa="btn-delete"]')
    await click({
        component: page,
        selector: 'button[data-qa="btn-save"]'
    })

    while (true) {
        let s = await page.$$('button[data-qa="btn-save"]');
        if (!s.length) break    
    }
    
    while (true) {
        await click({
            component: page,
            selector: 'button[data-test="next-button"]'
        })

        await wait(3000);

        let s = await page.$$('button[data-qa="submit-profile-top-btn"]')
        if (s.length) break;
    }
   

    click({
        component: page,
        selector: 'button[data-qa="submit-profile-top-btn"]'
    })

    await page.waitForNavigation();

    await page.goto('https://www.upwork.com/ab/messages/rooms/messages-settings-modal?pageTitle=Messages%20Settings&_modalInfo=%5B%7B%22navType%22%3A%22modal%22,%22title%22%3A%22Messages%20Settings%22,%22modalId%22%3A%221689843918277%22,%22channelName%22%3A%22messages-settings%22%7D%5D')

    await click({
        component: page,
        selector: '#dropdown-label-5'
    })

    await wait(2000)
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Enter')

    click({
        component: page,
        selector: 'button[data-ev-label="save_notification_settings"]'
    })

    await page.waitForNavigation();

    const saveFile = path.join(process.cwd(), process.argv[2].replace('.json', '.txt'))

    await writeFileAsync(saveFile, `${fake}\r\n`, "a+")
    
    await Logger(fake)

    await page.close()
    await browser.close()
}


async function main(number) {
    try {
        // disableLogger();
        
        const pathToProfile = path.join(process.cwd(), process.argv[2])
        let profile = await readFileAsync(pathToProfile)
        profile = JSON.parse(profile)

        let fake
        if (mode == 'temp') fake = await getFakeEmail()
        else if (mode == 'txt') fake = await getFakeEmailFromTxt()
        await Logger(fake)
        await Login(profile, fake)
        await Logger(`Successfully created!`)
    } catch(err) {
        console.log(err)
        await page.screenshot({ path: pathToScreen })
        await page.close()
        await browser.close()
    }
}


(async () => {
    const array = Array.from({ length: eval(process.argv[3]) });
    email = process.env.MAIN;
    password = process.env.MYPASSWORD;
    mode ='temp';
    await asyncForEach(array, main);

    process.exit()
})()
