// utility for project

const readline = require('readline')
const fs = require('fs')
const { exec } = require("child_process");


function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(error.message)
                reject(new Error(`Error: ${error.message}`));
                return;
            }
            if (stderr) {
                console.log(stderr)
                reject(new Error(`Stderr: ${stderr}`));
                return;
            }
            resolve(stdout);
        });
    });
}


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})


function ask(question) {
    return new Promise(resolve => {
        rl.question(question, input => resolve(input))
    })
}


function Logger(message) {
    return new Promise(resolve => {
        console.log('Log => ' + JSON.stringify(message))
        resolve()
    })
}


function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds)
    })
}


async function iframeAttached(page, url, num) {
    return new Promise(async resolve => {
        const pollingInterval = 1000;
        const poll = setInterval(async function waitForIFrameToLoad() {
            const iFrame = page.frames()
            const count = iFrame.reduce((acc, el) => el.url().includes(url) ? acc + 1 : acc, 0);
            if (count >= num) {
                clearInterval(poll);
                resolve(iFrame);
            }
        }, pollingInterval);
    });
}


function readFileAsync(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            resolve(data);
        } catch (error) {
            reject(error);
        }
    });
}


function writeFileAsync(path, data, mode) {
    return new Promise((resolve, reject) => {
        try {
            fs.writeFileSync(path, data, { flag: mode });
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}


module.exports = {
    ask, Logger, wait, readFileAsync, writeFileAsync, executeCommand
}