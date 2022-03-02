import { JSDOM } from 'jsdom';
import https from 'https';
import nodemailer from 'nodemailer';
import { exit } from 'process';

const URL = 'https://valogatottjegy.mlsz.hu/';

let body = '';

if (!process.env.SMTP_SERVER) {
	log('SMTP_SERVER environment variable is not set');
	exit();
}
if (!process.env.SMTP_USER) {
	log('SMTP_USER environment variable is not set');
	exit();
}
if (!process.env.SMTP_PASSWORD) {
	log('SMTP_USER environment variable is not set');
	exit();
}

let tickets: string[] = [];

let transporter = nodemailer.createTransport({
	host: process.env.SMTP_SERVER,
	port: 587,
	secure: false, // true for 465, false for other ports
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASSWORD
	}
});


getTickets();


function getTickets() {
	log(`Checking tickets at ${URL}...`);
	get(URL).then(body => {
		//log(`Loaded ${body.length} bytes`);
		const dom = new JSDOM(body);
		let buttons = dom.window.document.querySelectorAll('.buyTicketButton');
		log(`Found ${buttons.length} ticket button(s)`);

		if (buttons.length !== tickets.length) {
			return parseTickets(buttons);
		}

		let changed = false;
		buttons.forEach((button, index) => {
			let href = button.getAttribute('href');
			if (tickets[index] === undefined || tickets[index] !== href) {
				changed = true;
			}
		});

		if (changed) {
			return parseTickets(buttons);
		}

		log('No changes');
		return Promise.resolve();

	})
		.then(() => {
			let sleep = 300000 + Math.round(Math.random() * 300000);
			log(`Sleeping for ${sleep / 1000} seconds`);
			setTimeout(() => { getTickets() }, sleep);
		})
		.catch(err => {
			log(`Error: ${err}`);
		});
}


function parseTickets(elements: NodeListOf<Element>): Promise<void> {
	return new Promise((resolve, reject) => {
		tickets = [];
		elements.forEach(element => {
			tickets.push(element.getAttribute('href') || 'Unknown ticket link');
		});
		notify(tickets);
		resolve();
	});
}

function notify(tikcets: string[]): Promise<void> {


	return new Promise(async (resolve, reject) => {
		log(`Available tickets have changed!`);
		tickets.forEach(ticket => log(ticket));
		let info = await transporter.sendMail({
			from: '"Csaba Sipocz 👻" <glinto@gmail.com>', // sender address
			to: "glinto@gmail.com", // list of receivers
			subject: "Tickets have changed", // Subject line
			text: `Hi,

We just wanted to let you know that the available tickets at ${URL} have changed as per the following:

${tickets.join('\n')}

Rgds,
cs
			`,
		});
		log(`Email sent: ${info.messageId}`);
		resolve();
	});

}

function log(str: string) {
	console.log(`\x1b[36m[${new Date().toISOString()}]\x1b[0m ${str}`);
}

function get(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = '';
		https.get(url, res => {
			res.setEncoding("utf8");

			res.on("data", data => {
				body += data;
			});
			res.on("end", () => {
				resolve(body);
			});
		});
	});
}