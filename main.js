/**
 * Automation upwork account creation
 */

const puppeteer = require('puppeteer-extra');
const { click } = require('puppeteer-utilz');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { Telegraf } = require('telegraf');
const path = require('path');
const stealth = StealthPlugin();
require('dotenv').config();
const { wait, readFileAsync, writeFileAsync } = require('./utils.js');
puppeteer.use(StealthPlugin());
stealth.enabledEvasions.delete('iframe.contentWindow');

async function input(page, selector, key, delay = 0) {
    await page.waitForSelector(selector)
    await page.focus(selector)
    await page.keyboard.type(key, { delay: delay })
}

async function main() {

    // const pathToFile = path.join(process.cwd(), 'email.txt');
    // const content = await readFileAsync(pathToFile);
    // const emails = content.split('\r\n');
    // const remainingText = emails.slice(1).join('\r\n');
    // await writeFileAsync(pathToFile, `${remainingText}`, 'w');
    // const email = emails[0];
    const email = process.env.MYEMAIL;
    const bot = new Telegraf(process.env.TOKEN);
    let chat_id;
    let intervalID;
    let initHandler;
    let status = 0;

    const pathToExtension = path.join(process.cwd(), 'cookies');

    console.log(`Email: ${email}`);

    const options = {
        headless: "new",
        // executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
        args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
            '--js-flags=--expose-gc',
            `--force-device-scale-factor=0.75`,
            '--start-maximized',
            '--no-sandbox'
        ]
    };

    const browser = await puppeteer.launch(options);
    let page = await browser.newPage();

    await page.evaluate(() => gc());
    const client = await page.target().createCDPSession();

    await client.send('HeapProfiler.enable');
    await client.send('HeapProfiler.collectGarbage');
    await client.send('HeapProfiler.disable');

    await page.setRequestInterception(true);

    page.on('request', (request) => {

        if (['image', 'stylesheet', 'font', 'xhr', 'ping', 'other', 'media'].indexOf(request.resourceType()) !== -1) {
            request.abort();
        } else {
            // if (request.resourceType() == 'fetch') console.log(JSON.stringify(request));
            request.continue();
        }
    });

    await page.setCacheEnabled(false);

    await page.goto('https://www.upwork.com/ab/account-security/login');
    await input(page, '#login_username', email);
    await click({
        component: page,
        selector: '#login_password_continue'
    });

    await wait(1000);
    await input(page, '#login_password', process.env.MYPASSWORD);
    await Promise.all([
        page.waitForNavigation(),
        click({
            component: page,
            selector: '#login_control_continue'
        })
    ]);

    // await wait(5000);
    // await page.screenshot({
    //     path: 'screenshot.jpg',
    // });

    await page.waitForSelector('div[role="dialog"] button');
    let close = await page.$$('div[role="dialog"] button');
    console.log(close);
    await close[2].click();

    await wait(3000);
    await page.evaluate(() => {
        window.scrollBy(0, 500);
    });

    console.log("success login!");

    async function getInfoFromJob(job) {
        let info = {};
        info.title = await job.$eval('a', (element) => element.textContent.trim());
        info.href = await job.$eval('a', (element) => element.getAttribute('href'));
        info.budget = await job.$eval("small.text-muted.display-inline-block.text-muted", (element) => element.textContent.trim());
        info.content = await job.$eval("span[data-test='job-description-text']", (element) => element.textContent.trim());
        const skills = await job.$$eval('a.up-skill-badge', (elements) =>
            elements.map((element) => element.textContent.trim())
        );
        info.skill = skills;
        let el;
        el = await job.$("small.d-inline-block");
        if (el != null) info.props = await job.$eval("small.d-inline-block", (element) => element.textContent.trim());
        el = await job.$("div.badge-line");
        if (el != null) info.payment = await job.$eval("div.badge-line", (element) => element.textContent.trim());

        return info;
    }

    function getMessageFromJob(job) {
        let message;
        message = 'Job Details:\n\n';
        message += '👉 ' + job.title + '\n\n';
        for (let i of job.budget.split('\n'))
            message += i.trim() + ' ';

        message += '\n\n';
        if (job.props != undefined) message += job.props + '\n';
        if (job.payment != undefined) {
            for (let i of job.payment.split('\n'))
                message += i.trim() + ' ';
        }

        message += '\n\n';
        message += `👉  https://www.upwork.com${job.href}`;

        message += '\n\n';
        if (job.content != undefined) message += '👉 Description \n' + job.content + '\n\n';
        message += '👉 Skill \n'
        for (let skill of job.skill) {
            message += `<u>${skill}</u>  `;
        }

        // console.log(message);
        return message;
    }

    let latest = {};
    let lock = 0;
    const max_limit = 50;
    let limit = max_limit;

    async function reset() {
        
        lock = 1;

        console.log('Resetting ...');

        await page.reload();
        await page.evaluate(() => {
            window.scrollBy(0, 500);
        });

        await wait(1000 * 60);

        lock = 0;
        limit = max_limit;
    }

    async function intervalHandler(ctx) {
        if (lock == 1) { console.log('Checking reset ...'); return; }
        limit = limit - 1;

        let saved = await page.$x("//button[contains(@class, 'up-tab-btn') and contains(text(), 'Saved')]");
        await Promise.all([
            page.waitForNavigation(),
            saved[0].click()
        ]);

        let most = await page.$x("//button[contains(@class, 'up-tab-btn') and contains(text(), 'Most')]")
        await Promise.all([
            page.waitForNavigation(),
            most[0].click()
        ]);

        try {
            await page.waitForSelector("div[data-test='job-tile-list'] section");
        } catch (error) {
            console.log(error);
            await ctx.telegram.sendMessage(chat_id, 'Cannot find job list');
            await reset();
            return;
        }

        let jobs = [];
        while (jobs.length < 5) {
            // console.log(jobs.length);
            jobs = await page.$$("div[data-test='job-tile-list'] section");
        }

        let updates = [];
        for (let i = 0; i < 5; i++) {
            let info = await getInfoFromJob(jobs[i]);
            if (info.content == latest.content) {
                console.log(`Discovering latest job ${i} ...`);
                break
            }
            updates.push(info);
        }

        for (let job of updates.reverse()) {
            console.log(job.title);
            let msg = getMessageFromJob(job);
            try {
                await ctx.telegram.sendMessage(chat_id, msg, { parse_mode: 'HTML' });
            } catch (error) {
                console.log(`Error: ${error}`);
                delete job.content;
                msg = getMessageFromJob(job);
                await ctx.telegram.sendMessage(chat_id, msg, { parse_mode: 'HTML' });
            }
        }

        if (updates.length) {
            latest = await getInfoFromJob(jobs[0]);
            console.log(`latest: ${latest.title}`)
        }

        if (!limit) {
            await reset();
        }
    }

    bot.start((ctx) => {
        
        if (!status) {
            chat_id = ctx.chat.id;
            status = 1;
            ctx.reply('Welcome to the bot!');

            intervalID = setInterval(intervalHandler, 1000 * 12, ctx);
        } else {
            ctx.reply('Bot is alreay running!');
        }
    });

    // bot.command('stop', (ctx) => {

    //     if (status) {
    //         status = 0;
    //         clearInterval(intervalID);
    //         ctx.reply('wait a minute until browser is safe ...');

    //         page.reload()
    //             .then(() => {
    //                 return page.evaluate(() => {
    //                     window.scrollBy(0, 500);
    //                 });
    //             });

            
    //         setTimeout((ctx) => {
    //             ctx.reply('Stopped bot! You can start bot again.');
    //         }, 1000 * 60, ctx);
    //     }
    //     // bot.stop('SIGINT');
    // });

    bot.launch();

    process.once('SIGINT', () => {
        bot.stop('SIGINT');
        browser.close();
    });
    process.once('SIGTERM', () => {
        bot.stop('SIGTERM');
        browser.close();
    });

    console.log('Bot has started');
}

main();
