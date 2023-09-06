/**
 * Automation buy items in skinport.com
 */


const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const _ = require('lodash')
const { click, type, disableLogger, asyncForEach } = require('puppeteer-utilz')
const { ask, Logger, wait, readFileAsync, writeFileAsync, executeCommand } = require('./utils.js')
const path = require('path')
const stealth = StealthPlugin()
puppeteer.use(StealthPlugin())
stealth.enabledEvasions.delete('iframe.contentWindow')


async function input(page, selector, key, delay = 0) {
    await page.waitForSelector(selector, { waitUntil: "load" })
    await page.focus(selector)
    await page.keyboard.type(key, { delay: delay })
}


(async () => {
    try {
        const pathToExtension = path.join(process.cwd(), 'cookies')
        let options;

        options = {
            headless: false,
            // executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
                "--window-position=225,0"
            ]
        };
            
        let browser = await puppeteer.launch(options)

        let page = (await browser.pages())[0]

        await page.goto('https://www.upwork.com/ab/account-security/login')

    }
    catch (err) {
        console.error(err)
    }
})()

